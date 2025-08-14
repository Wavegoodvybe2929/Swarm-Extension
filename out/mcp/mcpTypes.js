"use strict";
/**
 * TypeScript definitions for Model Context Protocol (MCP) integration
 * Based on MCP specification and ruv-swarm-mcp implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPErrorCodes = void 0;
// Error codes (based on JSON-RPC 2.0 specification)
exports.MCPErrorCodes = {
    // JSON-RPC 2.0 errors
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    // MCP-specific errors
    SERVER_ERROR: -32000,
    TRANSPORT_ERROR: -32001,
    TIMEOUT_ERROR: -32002,
    AUTHENTICATION_ERROR: -32003,
    AUTHORIZATION_ERROR: -32004,
    RESOURCE_NOT_FOUND: -32005,
    TOOL_NOT_FOUND: -32006,
    PROMPT_NOT_FOUND: -32007,
};
//# sourceMappingURL=mcpTypes.js.map