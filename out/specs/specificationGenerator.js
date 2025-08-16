"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecificationGenerator = void 0;
const vscode = __importStar(require("vscode"));
class SpecificationGenerator {
    constructor(lmStudioServer) {
        this.lmStudioServer = lmStudioServer;
        this.outputChannel = vscode.window.createOutputChannel('Spec Generator');
    }
    async generateSpecification(request) {
        try {
            this.outputChannel.appendLine('📝 Generating comprehensive specification...');
            this.outputChannel.appendLine(`User Request: ${request.userRequest}`);
            // Build the prompt for LM Studio
            const prompt = this.buildSpecificationPrompt(request);
            // Get specification from LM Studio
            const response = await this.lmStudioServer.generateCompletion(prompt, {
                maxTokens: 4000,
                temperature: 0.3, // Lower temperature for more structured output
                stopSequences: ['---END_SPEC---']
            });
            // Parse the response into a structured specification
            const spec = this.parseSpecificationResponse(response, request);
            this.outputChannel.appendLine('✅ Specification generated successfully');
            this.outputChannel.appendLine(`Generated ${spec.tasks.length} tasks across ${spec.requirements.length} requirements`);
            return spec;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to generate specification: ${errorMessage}`);
            throw new Error(`Specification generation failed: ${errorMessage}`);
        }
    }
    buildSpecificationPrompt(request) {
        const { userRequest, context, preferences } = request;
        return `You are an expert software architect and project manager. Your task is to create a comprehensive, detailed specification for a software development project based on the user's request.

USER REQUEST:
"${userRequest}"

CONTEXT:
${context ? `
- Workspace: ${context.workspaceFolder || 'Not specified'}
- Active File: ${context.activeFile || 'None'}
- Project Type: ${context.projectType || 'General'}
- Existing Files: ${context.existingFiles?.join(', ') || 'None'}
` : 'No additional context provided'}

PREFERENCES:
${preferences ? `
- Complexity Level: ${preferences.complexity || 'moderate'}
- Timeline: ${preferences.timeline || 'normal'}
- Quality Level: ${preferences.quality || 'production'}
` : 'Standard preferences'}

Please generate a comprehensive specification following this EXACT format:

TITLE: [Clear, descriptive title for the project]

DESCRIPTION:
[2-3 paragraph description of what needs to be built, why it's needed, and the expected outcome]

REQUIREMENTS:
[List 5-10 specific, measurable requirements using EARS format (Entity, Action, Requirement, Specification)]
- REQ-001: The system SHALL [specific requirement]
- REQ-002: The system SHALL [specific requirement]
[Continue with more requirements...]

ARCHITECTURE:
[List 3-7 key architectural decisions and components]
- [Component/Pattern name]: [Description and rationale]
- [Component/Pattern name]: [Description and rationale]
[Continue with more architectural elements...]

TASKS:
[Break down the work into 5-15 specific, actionable tasks. Each task should be assigned to a specific agent type]

TASK-001:
- Type: design|implementation|testing|review|optimization
- Description: [Detailed description of what needs to be done]
- Agent: architect|coder|tester|analyst|researcher|reviewer|optimizer
- Dependencies: [List of other task IDs this depends on, or "none"]
- Duration: [Estimated hours]
- Acceptance: [Specific criteria for completion]

TASK-002:
- Type: design|implementation|testing|review|optimization
- Description: [Detailed description of what needs to be done]
- Agent: architect|coder|tester|analyst|researcher|reviewer|optimizer
- Dependencies: [List of other task IDs this depends on, or "none"]
- Duration: [Estimated hours]
- Acceptance: [Specific criteria for completion]

[Continue with more tasks...]

ACCEPTANCE_CRITERIA:
[List 3-8 high-level criteria that define when the project is complete]
- [Specific, testable criterion]
- [Specific, testable criterion]
[Continue with more criteria...]

PRIORITY: low|medium|high|critical
ESTIMATED_DURATION: [Total estimated hours]
DEPENDENCIES: [External dependencies or "none"]

---END_SPEC---

IMPORTANT GUIDELINES:
1. Be specific and actionable - avoid vague descriptions
2. Ensure tasks have clear dependencies and can be executed by the specified agent types
3. Include both functional and non-functional requirements
4. Consider security, performance, and maintainability
5. Break complex work into manageable tasks
6. Assign appropriate agent types based on task nature:
   - architect: System design, architecture decisions, component planning
   - coder: Implementation, coding, bug fixes, feature development
   - tester: Test creation, quality assurance, validation
   - analyst: Performance analysis, code review, metrics
   - researcher: Information gathering, solution exploration
   - reviewer: Code review, security analysis, best practices
   - optimizer: Performance optimization, efficiency improvements

Generate the specification now:`;
    }
    parseSpecificationResponse(response, request) {
        try {
            // Extract sections from the response
            const sections = this.extractSections(response);
            // Generate unique ID
            const specId = `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // Parse tasks
            const tasks = this.parseTasks(sections.tasks || '');
            // Build the specification object
            const spec = {
                id: specId,
                title: sections.title || this.generateFallbackTitle(request.userRequest),
                description: sections.description || request.userRequest,
                requirements: this.parseRequirements(sections.requirements || ''),
                architecture: this.parseArchitecture(sections.architecture || ''),
                tasks,
                acceptanceCriteria: this.parseAcceptanceCriteria(sections.acceptance_criteria || ''),
                priority: this.parsePriority(sections.priority || 'medium'),
                estimatedDuration: this.parseEstimatedDuration(sections.estimated_duration || ''),
                dependencies: this.parseDependencies(sections.dependencies || '')
            };
            // Validate the specification
            this.validateSpecification(spec);
            return spec;
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Error parsing specification, creating fallback: ${error}`);
            return this.createFallbackSpecification(request);
        }
    }
    extractSections(response) {
        const sections = {};
        // Define section patterns
        const sectionPatterns = {
            title: /TITLE:\s*(.+?)(?=\n\n|\nDESCRIPTION:)/s,
            description: /DESCRIPTION:\s*(.+?)(?=\n\n|\nREQUIREMENTS:)/s,
            requirements: /REQUIREMENTS:\s*(.+?)(?=\n\n|\nARCHITECTURE:)/s,
            architecture: /ARCHITECTURE:\s*(.+?)(?=\n\n|\nTASKS:)/s,
            tasks: /TASKS:\s*(.+?)(?=\n\n|\nACCEPTANCE_CRITERIA:)/s,
            acceptance_criteria: /ACCEPTANCE_CRITERIA:\s*(.+?)(?=\n\n|\nPRIORITY:)/s,
            priority: /PRIORITY:\s*(.+?)(?=\n|\nESTIMATED_DURATION:)/s,
            estimated_duration: /ESTIMATED_DURATION:\s*(.+?)(?=\n|\nDEPENDENCIES:)/s,
            dependencies: /DEPENDENCIES:\s*(.+?)(?=\n|---END_SPEC---)/s
        };
        // Extract each section
        for (const [key, pattern] of Object.entries(sectionPatterns)) {
            const match = response.match(pattern);
            if (match) {
                sections[key] = match[1].trim();
            }
        }
        return sections;
    }
    parseTasks(tasksSection) {
        const tasks = [];
        // Split by TASK- pattern
        const taskBlocks = tasksSection.split(/TASK-\d+:/).filter(block => block.trim());
        for (let i = 0; i < taskBlocks.length; i++) {
            const block = taskBlocks[i].trim();
            if (!block) {
                continue;
            }
            const task = this.parseTaskBlock(block, i + 1);
            if (task) {
                tasks.push(task);
            }
        }
        // If no tasks were parsed, create a default task
        if (tasks.length === 0) {
            tasks.push({
                id: 'task-001',
                type: 'implementation',
                description: 'Implement the requested functionality',
                assignedAgentType: 'coder',
                dependencies: [],
                estimatedDuration: 8,
                acceptanceCriteria: ['Functionality works as requested', 'Code is tested and documented']
            });
        }
        return tasks;
    }
    parseTaskBlock(block, index) {
        try {
            const lines = block.split('\n').map(line => line.trim()).filter(line => line);
            const task = {
                id: `task-${String(index).padStart(3, '0')}`
            };
            for (const line of lines) {
                if (line.startsWith('- Type:')) {
                    const type = line.replace('- Type:', '').trim();
                    task.type = this.validateTaskType(type);
                }
                else if (line.startsWith('- Description:')) {
                    task.description = line.replace('- Description:', '').trim();
                }
                else if (line.startsWith('- Agent:')) {
                    task.assignedAgentType = line.replace('- Agent:', '').trim();
                }
                else if (line.startsWith('- Dependencies:')) {
                    const deps = line.replace('- Dependencies:', '').trim();
                    task.dependencies = deps === 'none' ? [] : deps.split(',').map(d => d.trim());
                }
                else if (line.startsWith('- Duration:')) {
                    const duration = line.replace('- Duration:', '').trim();
                    task.estimatedDuration = this.parseDuration(duration);
                }
                else if (line.startsWith('- Acceptance:')) {
                    const acceptance = line.replace('- Acceptance:', '').trim();
                    task.acceptanceCriteria = [acceptance];
                }
            }
            // Validate required fields
            if (!task.type || !task.description || !task.assignedAgentType) {
                return null;
            }
            return task;
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Error parsing task block: ${error}`);
            return null;
        }
    }
    validateTaskType(type) {
        const validTypes = ['design', 'implementation', 'testing', 'review', 'optimization'];
        const normalizedType = type.toLowerCase();
        if (validTypes.includes(normalizedType)) {
            return normalizedType;
        }
        // Map common variations
        if (normalizedType.includes('implement') || normalizedType.includes('code') || normalizedType.includes('develop')) {
            return 'implementation';
        }
        if (normalizedType.includes('test') || normalizedType.includes('qa')) {
            return 'testing';
        }
        if (normalizedType.includes('review') || normalizedType.includes('audit')) {
            return 'review';
        }
        if (normalizedType.includes('design') || normalizedType.includes('architect')) {
            return 'design';
        }
        if (normalizedType.includes('optim') || normalizedType.includes('performance')) {
            return 'optimization';
        }
        return 'implementation'; // Default fallback
    }
    parseDuration(duration) {
        const match = duration.match(/(\d+)/);
        return match ? parseInt(match[1]) : 4; // Default 4 hours
    }
    parseRequirements(requirementsSection) {
        const lines = requirementsSection.split('\n').map(line => line.trim()).filter(line => line);
        return lines
            .filter(line => line.startsWith('-') || line.match(/REQ-\d+:/))
            .map(line => line.replace(/^-\s*/, '').replace(/REQ-\d+:\s*/, ''))
            .filter(req => req.length > 0);
    }
    parseArchitecture(architectureSection) {
        const lines = architectureSection.split('\n').map(line => line.trim()).filter(line => line);
        return lines
            .filter(line => line.startsWith('-') || line.includes(':'))
            .map(line => line.replace(/^-\s*/, ''))
            .filter(arch => arch.length > 0);
    }
    parseAcceptanceCriteria(criteriaSection) {
        const lines = criteriaSection.split('\n').map(line => line.trim()).filter(line => line);
        return lines
            .filter(line => line.startsWith('-'))
            .map(line => line.replace(/^-\s*/, ''))
            .filter(criteria => criteria.length > 0);
    }
    parsePriority(priority) {
        const normalizedPriority = priority.toLowerCase().trim();
        const validPriorities = ['low', 'medium', 'high', 'critical'];
        if (validPriorities.includes(normalizedPriority)) {
            return normalizedPriority;
        }
        return 'medium'; // Default fallback
    }
    parseEstimatedDuration(duration) {
        const match = duration.match(/(\d+)/);
        return match ? parseInt(match[1]) : 16; // Default 16 hours
    }
    parseDependencies(dependencies) {
        if (dependencies.toLowerCase().includes('none')) {
            return [];
        }
        return dependencies.split(',').map(dep => dep.trim()).filter(dep => dep.length > 0);
    }
    generateFallbackTitle(userRequest) {
        // Extract key words from user request to create a title
        const words = userRequest.split(' ').slice(0, 6);
        return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    validateSpecification(spec) {
        if (!spec.title || spec.title.length < 3) {
            throw new Error('Specification title is too short');
        }
        if (!spec.description || spec.description.length < 10) {
            throw new Error('Specification description is too short');
        }
        if (spec.tasks.length === 0) {
            throw new Error('Specification must have at least one task');
        }
        if (spec.requirements.length === 0) {
            throw new Error('Specification must have at least one requirement');
        }
    }
    createFallbackSpecification(request) {
        const specId = `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return {
            id: specId,
            title: this.generateFallbackTitle(request.userRequest),
            description: request.userRequest,
            requirements: [
                'The system SHALL implement the requested functionality',
                'The system SHALL be tested and validated',
                'The system SHALL follow coding best practices'
            ],
            architecture: [
                'Modular design with clear separation of concerns',
                'Error handling and logging',
                'Documentation and comments'
            ],
            tasks: [
                {
                    id: 'task-001',
                    type: 'design',
                    description: 'Design the system architecture and components',
                    assignedAgentType: 'architect',
                    dependencies: [],
                    estimatedDuration: 4,
                    acceptanceCriteria: ['Architecture is documented', 'Components are clearly defined']
                },
                {
                    id: 'task-002',
                    type: 'implementation',
                    description: 'Implement the core functionality',
                    assignedAgentType: 'coder',
                    dependencies: ['task-001'],
                    estimatedDuration: 8,
                    acceptanceCriteria: ['Code is functional', 'Code follows standards']
                },
                {
                    id: 'task-003',
                    type: 'testing',
                    description: 'Create and run comprehensive tests',
                    assignedAgentType: 'tester',
                    dependencies: ['task-002'],
                    estimatedDuration: 4,
                    acceptanceCriteria: ['All tests pass', 'Coverage is adequate']
                }
            ],
            acceptanceCriteria: [
                'All requirements are implemented',
                'All tests pass',
                'Code is documented and follows standards'
            ],
            priority: 'medium',
            estimatedDuration: 16,
            dependencies: []
        };
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.SpecificationGenerator = SpecificationGenerator;
//# sourceMappingURL=specificationGenerator.js.map