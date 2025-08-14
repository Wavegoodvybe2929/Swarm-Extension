/**
 * MCP Transport Layer - Handles stdio and WebSocket communications
 */

import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
    MCPMessage,
    MCPRequest,
    MCPResponse,
    MCPTransportType,
    MCPTransportConfig,
    MCPStdioConfig,
    MCPWebSocketConfig,
    MCPConnectionState,
    MCPErrorCodes
} from './mcpTypes';

export interface MCPTransportEvents {
    'message': (message: MCPMessage) => void;
    'connected': () => void;
    'disconnected': () => void;
    'error': (error: Error) => void;
    'state-changed': (state: MCPConnectionState) => void;
}

export abstract class MCPTransport extends EventEmitter {
    protected _state: MCPConnectionState = 'disconnected';
    protected _config: MCPTransportConfig;
    protected _requestId = 0;
    protected _pendingRequests = new Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }>();

    constructor(config: MCPTransportConfig) {
        super();
        this._config = config;
    }

    get state(): MCPConnectionState {
        return this._state;
    }

    get config(): MCPTransportConfig {
        return this._config;
    }

    protected setState(state: MCPConnectionState): void {
        if (this._state !== state) {
            this._state = state;
            this.emit('state-changed', state);
        }
    }

    protected generateRequestId(): string {
        return `req_${++this._requestId}_${Date.now()}`;
    }

    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract send(message: MCPMessage): Promise<void>;

    async sendRequest(method: string, params?: any, timeout = 30000): Promise<any> {
        const id = this.generateRequestId();
        const request: MCPRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this._pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, timeout);

            this._pendingRequests.set(id, {
                resolve,
                reject,
                timeout: timeoutHandle
            });

            this.send(request).catch(error => {
                this._pendingRequests.delete(id);
                clearTimeout(timeoutHandle);
                reject(error);
            });
        });
    }

    protected handleMessage(message: MCPMessage): void {
        // Handle responses to pending requests
        if (message.id && this._pendingRequests.has(message.id)) {
            const pending = this._pendingRequests.get(message.id)!;
            this._pendingRequests.delete(message.id);
            clearTimeout(pending.timeout);

            if (message.error) {
                pending.reject(new Error(`MCP Error ${message.error.code}: ${message.error.message}`));
            } else {
                pending.resolve(message.result);
            }
            return;
        }

        // Emit message for other handlers
        this.emit('message', message);
    }

    dispose(): void {
        // Clear all pending requests
        for (const [id, pending] of this._pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Transport disposed'));
        }
        this._pendingRequests.clear();
        
        this.disconnect().catch(() => {
            // Ignore errors during disposal
        });
    }
}

export class MCPStdioTransport extends MCPTransport {
    private _process?: ChildProcess;
    private _buffer = '';

    constructor(config: MCPTransportConfig) {
        super(config);
        if (!config.stdio) {
            throw new Error('Stdio configuration required for stdio transport');
        }
    }

    async connect(): Promise<void> {
        if (this._state === 'connected' || this._state === 'connecting') {
            return;
        }

        this.setState('connecting');

        try {
            const stdioConfig = this._config.stdio!;
            
            this._process = spawn(stdioConfig.command, stdioConfig.args || [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, ...stdioConfig.env },
                cwd: stdioConfig.cwd
            });

            this._process.on('error', (error) => {
                this.setState('error');
                this.emit('error', error);
            });

            this._process.on('exit', (code, signal) => {
                this.setState('disconnected');
                this.emit('disconnected');
                if (code !== 0) {
                    this.emit('error', new Error(`Process exited with code ${code}, signal ${signal}`));
                }
            });

            this._process.stdout?.on('data', (data) => {
                this._buffer += data.toString();
                this._processBuffer();
            });

            this._process.stderr?.on('data', (data) => {
                console.error('MCP Server stderr:', data.toString());
            });

            // Wait a bit for the process to start
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (this._process.exitCode !== null) {
                throw new Error('Process exited immediately');
            }

            this.setState('connected');
            this.emit('connected');
        } catch (error) {
            this.setState('error');
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this._process) {
            this._process.kill();
            this._process = undefined;
        }
        this.setState('disconnected');
        this.emit('disconnected');
    }

    async send(message: MCPMessage): Promise<void> {
        if (!this._process || !this._process.stdin) {
            throw new Error('Not connected');
        }

        const messageStr = JSON.stringify(message) + '\n';
        
        return new Promise((resolve, reject) => {
            this._process!.stdin!.write(messageStr, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private _processBuffer(): void {
        const lines = this._buffer.split('\n');
        this._buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line) as MCPMessage;
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse MCP message:', line, error);
                }
            }
        }
    }
}

export class MCPWebSocketTransport extends MCPTransport {
    private _ws?: WebSocket;
    private _reconnectAttempts = 0;
    private _maxReconnectAttempts = 5;
    private _reconnectDelay = 1000;

    constructor(config: MCPTransportConfig) {
        super(config);
        if (!config.websocket) {
            throw new Error('WebSocket configuration required for WebSocket transport');
        }
    }

    async connect(): Promise<void> {
        if (this._state === 'connected' || this._state === 'connecting') {
            return;
        }

        this.setState('connecting');

        try {
            const wsConfig = this._config.websocket!;
            
            this._ws = new WebSocket(wsConfig.url, wsConfig.protocols, {
                headers: wsConfig.headers,
                handshakeTimeout: wsConfig.timeout || 30000
            });

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, wsConfig.timeout || 30000);

                this._ws!.on('open', () => {
                    clearTimeout(timeout);
                    this._reconnectAttempts = 0;
                    this.setState('connected');
                    this.emit('connected');
                    resolve();
                });

                this._ws!.on('error', (error: Error) => {
                    clearTimeout(timeout);
                    this.setState('error');
                    this.emit('error', error);
                    reject(error);
                });

                this._ws!.on('close', (code: number, reason: Buffer) => {
                    clearTimeout(timeout);
                    this.setState('disconnected');
                    this.emit('disconnected');
                    
                    // Attempt reconnection if not manually disconnected
                    if (code !== 1000 && this._reconnectAttempts < this._maxReconnectAttempts) {
                        this._scheduleReconnect();
                    }
                });

                this._ws!.on('message', (data: WebSocket.Data) => {
                    try {
                        const message = JSON.parse(data.toString()) as MCPMessage;
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Failed to parse WebSocket message:', data.toString(), error);
                    }
                });
            });
        } catch (error) {
            this.setState('error');
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        this._reconnectAttempts = this._maxReconnectAttempts; // Prevent reconnection
        
        if (this._ws) {
            this._ws.close(1000, 'Normal closure');
            this._ws = undefined;
        }
        
        this.setState('disconnected');
        this.emit('disconnected');
    }

    async send(message: MCPMessage): Promise<void> {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve, reject) => {
            this._ws!.send(JSON.stringify(message), (error?: Error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private _scheduleReconnect(): void {
        this._reconnectAttempts++;
        const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);
        
        setTimeout(() => {
            if (this._state === 'disconnected') {
                this.connect().catch(error => {
                    console.error('Reconnection failed:', error);
                });
            }
        }, delay);
    }
}

export class MCPTransportFactory {
    static create(config: MCPTransportConfig): MCPTransport {
        switch (config.type) {
            case 'stdio':
                return new MCPStdioTransport(config);
            case 'websocket':
                return new MCPWebSocketTransport(config);
            default:
                throw new Error(`Unsupported transport type: ${config.type}`);
        }
    }

    static createStdioTransport(command: string, args?: string[], options?: {
        env?: Record<string, string>;
        cwd?: string;
    }): MCPStdioTransport {
        return new MCPStdioTransport({
            type: 'stdio',
            stdio: {
                command,
                args,
                env: options?.env,
                cwd: options?.cwd
            }
        });
    }

    static createWebSocketTransport(url: string, options?: {
        headers?: Record<string, string>;
        protocols?: string[];
        timeout?: number;
    }): MCPWebSocketTransport {
        return new MCPWebSocketTransport({
            type: 'websocket',
            websocket: {
                url,
                headers: options?.headers,
                protocols: options?.protocols,
                timeout: options?.timeout
            }
        });
    }
}
