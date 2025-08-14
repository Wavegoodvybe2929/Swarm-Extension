"use strict";
// Type definitions for RUV-Swarm VSCode Extension
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskError = exports.AgentError = exports.SwarmError = void 0;
// Error types
class SwarmError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'SwarmError';
    }
}
exports.SwarmError = SwarmError;
class AgentError extends SwarmError {
    constructor(message, agentId, details) {
        super(message, 'AGENT_ERROR', details);
        this.agentId = agentId;
        this.name = 'AgentError';
    }
}
exports.AgentError = AgentError;
class TaskError extends SwarmError {
    constructor(message, taskId, details) {
        super(message, 'TASK_ERROR', details);
        this.taskId = taskId;
        this.name = 'TaskError';
    }
}
exports.TaskError = TaskError;
//# sourceMappingURL=index.js.map