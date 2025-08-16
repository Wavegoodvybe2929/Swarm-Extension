import { SpecificationTask } from '../types';
import { LMStudioServer } from '../mcp/servers/lmStudioServer';
export interface SpecGenerationRequest {
    userRequest: string;
    context?: {
        workspaceFolder?: string;
        activeFile?: string;
        projectType?: string;
        existingFiles?: string[];
    };
    preferences?: {
        complexity?: 'simple' | 'moderate' | 'complex';
        timeline?: 'urgent' | 'normal' | 'extended';
        quality?: 'basic' | 'production' | 'enterprise';
    };
}
export declare class SpecificationGenerator {
    private lmStudioServer;
    private outputChannel;
    constructor(lmStudioServer: LMStudioServer);
    generateSpecification(request: SpecGenerationRequest): Promise<SpecificationTask>;
    private buildSpecificationPrompt;
    private parseSpecificationResponse;
    private extractSections;
    private parseTasks;
    private parseTaskBlock;
    private validateTaskType;
    private parseDuration;
    private parseRequirements;
    private parseArchitecture;
    private parseAcceptanceCriteria;
    private parsePriority;
    private parseEstimatedDuration;
    private parseDependencies;
    private generateFallbackTitle;
    private validateSpecification;
    private createFallbackSpecification;
    dispose(): void;
}
//# sourceMappingURL=specificationGenerator.d.ts.map