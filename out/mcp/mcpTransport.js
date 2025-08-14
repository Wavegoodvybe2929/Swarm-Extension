"use strict";
/**
 * MCP Transport Layer - Handles stdio and WebSocket communications
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPTransportFactory = exports.MCPWebSocketTransport = exports.MCPStdioTransport = exports.MCPTransport = void 0;
const child_process_1 = require("child_process");
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
class MCPTransport extends events_1.EventEmitter {
    constructor(config) {
        super();
        this._state = 'disconnected';
        this._requestId = 0;
        this._pendingRequests = new Map();
        this._config = config;
    }
    get state() {
        return this._state;
    }
    get config() {
        return this._config;
    }
    setState(state) {
        if (this._state !== state) {
            this._state = state;
            this.emit('state-changed', state);
        }
    }
    generateRequestId() {
        return `req_${++this._requestId}_${Date.now()}`;
    }
    async sendRequest(method, params, timeout = 30000) {
        const id = this.generateRequestId();
        const request = {
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
    handleMessage(message) {
        // Handle responses to pending requests
        if (message.id && this._pendingRequests.has(message.id)) {
            const pending = this._pendingRequests.get(message.id);
            this._pendingRequests.delete(message.id);
            clearTimeout(pending.timeout);
            if (message.error) {
                pending.reject(new Error(`MCP Error ${message.error.code}: ${message.error.message}`));
            }
            else {
                pending.resolve(message.result);
            }
            return;
        }
        // Emit message for other handlers
        this.emit('message', message);
    }
    dispose() {
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
exports.MCPTransport = MCPTransport;
class MCPStdioTransport extends MCPTransport {
    constructor(config) {
        super(config);
        this._buffer = '';
        if (!config.stdio) {
            throw new Error('Stdio configuration required for stdio transport');
        }
    }
    async connect() {
        if (this._state === 'connected' || this._state === 'connecting') {
            return;
        }
        this.setState('connecting');
        try {
            const stdioConfig = this._config.stdio;
            this._process = (0, child_process_1.spawn)(stdioConfig.command, stdioConfig.args || [], {
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
        }
        catch (error) {
            this.setState('error');
            throw error;
        }
    }
    async disconnect() {
        if (this._process) {
            this._process.kill();
            this._process = undefined;
        }
        this.setState('disconnected');
        this.emit('disconnected');
    }
    async send(message) {
        if (!this._process || !this._process.stdin) {
            throw new Error('Not connected');
        }
        const messageStr = JSON.stringify(message) + '\n';
        return new Promise((resolve, reject) => {
            this._process.stdin.write(messageStr, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    _processBuffer() {
        const lines = this._buffer.split('\n');
        this._buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);
                    this.handleMessage(message);
                }
                catch (error) {
                    console.error('Failed to parse MCP message:', line, error);
                }
            }
        }
    }
}
exports.MCPStdioTransport = MCPStdioTransport;
class MCPWebSocketTransport extends MCPTransport {
    constructor(config) {
        super(config);
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
        this._reconnectDelay = 1000;
        if (!config.websocket) {
            throw new Error('WebSocket configuration required for WebSocket transport');
        }
    }
    async connect() {
        if (this._state === 'connected' || this._state === 'connecting') {
            return;
        }
        this.setState('connecting');
        try {
            const wsConfig = this._config.websocket;
            this._ws = new ws_1.default(wsConfig.url, wsConfig.protocols, {
                headers: wsConfig.headers,
                handshakeTimeout: wsConfig.timeout || 30000
            });
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, wsConfig.timeout || 30000);
                this._ws.on('open', () => {
                    clearTimeout(timeout);
                    this._reconnectAttempts = 0;
                    this.setState('connected');
                    this.emit('connected');
                    resolve();
                });
                this._ws.on('error', (error) => {
                    clearTimeout(timeout);
                    this.setState('error');
                    this.emit('error', error);
                    reject(error);
                });
                this._ws.on('close', (code, reason) => {
                    clearTimeout(timeout);
                    this.setState('disconnected');
                    this.emit('disconnected');
                    // Attempt reconnection if not manually disconnected
                    if (code !== 1000 && this._reconnectAttempts < this._maxReconnectAttempts) {
                        this._scheduleReconnect();
                    }
                });
                this._ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    }
                    catch (error) {
                        console.error('Failed to parse WebSocket message:', data.toString(), error);
                    }
                });
            });
        }
        catch (error) {
            this.setState('error');
            throw error;
        }
    }
    async disconnect() {
        this._reconnectAttempts = this._maxReconnectAttempts; // Prevent reconnection
        if (this._ws) {
            this._ws.close(1000, 'Normal closure');
            this._ws = undefined;
        }
        this.setState('disconnected');
        this.emit('disconnected');
    }
    async send(message) {
        if (!this._ws || this._ws.readyState !== ws_1.default.OPEN) {
            throw new Error('WebSocket not connected');
        }
        return new Promise((resolve, reject) => {
            this._ws.send(JSON.stringify(message), (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    _scheduleReconnect() {
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
exports.MCPWebSocketTransport = MCPWebSocketTransport;
class MCPTransportFactory {
    static create(config) {
        switch (config.type) {
            case 'stdio':
                return new MCPStdioTransport(config);
            case 'websocket':
                return new MCPWebSocketTransport(config);
            default:
                throw new Error(`Unsupported transport type: ${config.type}`);
        }
    }
    static createStdioTransport(command, args, options) {
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
    static createWebSocketTransport(url, options) {
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
exports.MCPTransportFactory = MCPTransportFactory;
//# sourceMappingURL=mcpTransport.js.map