import * as vscode from 'vscode';
import { Agent, Task, HiveConfig } from '../types';

export type CoordinationTopology = 'mesh' | 'hierarchical' | 'ring' | 'star';
export type CoordinationStrategy = 'parallel' | 'sequential' | 'adaptive' | 'hybrid';

export interface TopologyConfig {
    type: CoordinationTopology;
    maxAgents: number;
    loadBalancingEnabled: boolean;
    faultToleranceEnabled: boolean;
    autoOptimization: boolean;
}

export interface CoordinationMetrics {
    efficiency: number;
    latency: number;
    throughput: number;
    faultTolerance: number;
    scalability: number;
}

export interface TopologyNode {
    agentId: string;
    connections: string[];
    role: 'coordinator' | 'worker' | 'bridge';
    load: number;
    status: 'active' | 'busy' | 'idle' | 'error';
}

export class TopologyManager implements vscode.Disposable {
    private currentTopology: CoordinationTopology;
    private topologyConfig: TopologyConfig;
    private nodes: Map<string, TopologyNode> = new Map();
    private connections: Map<string, Set<string>> = new Map();
    private metrics: CoordinationMetrics;
    private outputChannel: vscode.OutputChannel;
    private isOptimizing = false;

    constructor(config: HiveConfig) {
        this.currentTopology = config.topology;
        this.topologyConfig = {
            type: config.topology,
            maxAgents: config.maxAgents || 10,
            loadBalancingEnabled: true,
            faultToleranceEnabled: true,
            autoOptimization: config.enableOptimization || true
        };
        
        this.metrics = {
            efficiency: 0.0,
            latency: 0.0,
            throughput: 0.0,
            faultTolerance: 0.0,
            scalability: 0.0
        };

        this.outputChannel = vscode.window.createOutputChannel('Topology Manager');
    }

    async initializeTopology(agents: Agent[]): Promise<void> {
        try {
            this.outputChannel.appendLine(`🔗 Initializing ${this.currentTopology} topology with ${agents.length} agents`);

            // Clear existing topology
            this.nodes.clear();
            this.connections.clear();

            // Create nodes for each agent
            for (const agent of agents) {
                this.nodes.set(agent.id, {
                    agentId: agent.id,
                    connections: [],
                    role: this.determineNodeRole(agent, agents),
                    load: 0,
                    status: agent.status as any
                });
            }

            // Build topology connections
            await this.buildTopologyConnections();

            // Calculate initial metrics
            await this.updateMetrics();

            this.outputChannel.appendLine(`✅ ${this.currentTopology} topology initialized successfully`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to initialize topology: ${error}`);
            throw error;
        }
    }

    async switchTopology(newTopology: CoordinationTopology, agents: Agent[]): Promise<void> {
        try {
            this.outputChannel.appendLine(`🔄 Switching from ${this.currentTopology} to ${newTopology} topology`);

            const oldTopology = this.currentTopology;
            this.currentTopology = newTopology;
            this.topologyConfig.type = newTopology;

            // Rebuild topology with new structure
            await this.initializeTopology(agents);

            // Compare metrics and rollback if performance degrades significantly
            if (this.topologyConfig.autoOptimization) {
                const newMetrics = await this.calculateMetrics();
                if (newMetrics.efficiency < this.metrics.efficiency * 0.8) {
                    this.outputChannel.appendLine(`⚠️ Performance degradation detected, rolling back to ${oldTopology}`);
                    this.currentTopology = oldTopology;
                    await this.initializeTopology(agents);
                    return;
                }
            }

            this.outputChannel.appendLine(`✅ Successfully switched to ${newTopology} topology`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to switch topology: ${error}`);
            throw error;
        }
    }

    async addAgent(agent: Agent): Promise<void> {
        try {
            this.outputChannel.appendLine(`➕ Adding agent ${agent.id} to ${this.currentTopology} topology`);

            // Create node for new agent
            const newNode: TopologyNode = {
                agentId: agent.id,
                connections: [],
                role: this.determineNodeRole(agent, Array.from(this.nodes.values()).map(n => ({ id: n.agentId } as Agent))),
                load: 0,
                status: agent.status as any
            };

            this.nodes.set(agent.id, newNode);

            // Rebuild connections to include new agent
            await this.buildTopologyConnections();

            // Update metrics
            await this.updateMetrics();

            this.outputChannel.appendLine(`✅ Agent ${agent.id} added to topology`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to add agent to topology: ${error}`);
            throw error;
        }
    }

    async removeAgent(agentId: string): Promise<void> {
        try {
            this.outputChannel.appendLine(`➖ Removing agent ${agentId} from topology`);

            // Remove node
            this.nodes.delete(agentId);

            // Remove all connections to this agent
            for (const [nodeId, connections] of this.connections) {
                connections.delete(agentId);
            }
            this.connections.delete(agentId);

            // Update node connections
            for (const node of this.nodes.values()) {
                node.connections = node.connections.filter(id => id !== agentId);
            }

            // Rebuild connections to maintain topology integrity
            await this.buildTopologyConnections();

            // Update metrics
            await this.updateMetrics();

            this.outputChannel.appendLine(`✅ Agent ${agentId} removed from topology`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to remove agent from topology: ${error}`);
            throw error;
        }
    }

    async getOptimalStrategy(task: Task): Promise<CoordinationStrategy> {
        const taskComplexity = this.calculateTaskComplexity(task);
        const availableAgents = Array.from(this.nodes.values()).filter(n => n.status === 'idle').length;
        const currentLoad = this.calculateAverageLoad();

        // Decision logic based on task characteristics and topology state
        if (taskComplexity < 0.3 && availableAgents >= 2) {
            return 'parallel';
        } else if (taskComplexity > 0.7 || currentLoad > 0.8) {
            return 'sequential';
        } else if (this.currentTopology === 'mesh' && availableAgents >= 3) {
            return 'adaptive';
        } else {
            return 'hybrid';
        }
    }

    async getCoordinationPath(fromAgent: string, toAgent: string): Promise<string[]> {
        // Find optimal path between agents based on current topology
        switch (this.currentTopology) {
            case 'mesh':
                return this.findDirectPath(fromAgent, toAgent);
            case 'hierarchical':
                return this.findHierarchicalPath(fromAgent, toAgent);
            case 'ring':
                return this.findRingPath(fromAgent, toAgent);
            case 'star':
                return this.findStarPath(fromAgent, toAgent);
            default:
                return [fromAgent, toAgent];
        }
    }

    async optimizeTopology(): Promise<void> {
        if (this.isOptimizing) {return;}

        try {
            this.isOptimizing = true;
            this.outputChannel.appendLine(`🔧 Optimizing ${this.currentTopology} topology`);

            // Analyze current performance
            const currentMetrics = await this.calculateMetrics();
            
            // Try different optimizations based on topology type
            const optimizations = await this.generateOptimizations();
            
            let bestOptimization = null;
            let bestScore = this.calculateOverallScore(currentMetrics);

            for (const optimization of optimizations) {
                const testMetrics = await this.simulateOptimization(optimization);
                const score = this.calculateOverallScore(testMetrics);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestOptimization = optimization;
                }
            }

            if (bestOptimization) {
                await this.applyOptimization(bestOptimization);
                this.outputChannel.appendLine(`✅ Topology optimized - improvement: ${((bestScore / this.calculateOverallScore(currentMetrics) - 1) * 100).toFixed(1)}%`);
            } else {
                this.outputChannel.appendLine(`ℹ️ No beneficial optimizations found`);
            }

        } catch (error) {
            this.outputChannel.appendLine(`❌ Topology optimization failed: ${error}`);
        } finally {
            this.isOptimizing = false;
        }
    }

    getTopologyMetrics(): CoordinationMetrics {
        return { ...this.metrics };
    }

    getTopologyVisualization(): any {
        return {
            topology: this.currentTopology,
            nodes: Array.from(this.nodes.values()),
            connections: Array.from(this.connections.entries()).map(([from, toSet]) => ({
                from,
                to: Array.from(toSet)
            })),
            metrics: this.metrics
        };
    }

    private async buildTopologyConnections(): Promise<void> {
        const agents = Array.from(this.nodes.keys());
        
        switch (this.currentTopology) {
            case 'mesh':
                await this.buildMeshTopology(agents);
                break;
            case 'hierarchical':
                await this.buildHierarchicalTopology(agents);
                break;
            case 'ring':
                await this.buildRingTopology(agents);
                break;
            case 'star':
                await this.buildStarTopology(agents);
                break;
        }
    }

    private async buildMeshTopology(agents: string[]): Promise<void> {
        // Full mesh - every agent connected to every other agent
        for (const agentId of agents) {
            const connections = new Set<string>();
            const node = this.nodes.get(agentId)!;
            
            for (const otherId of agents) {
                if (otherId !== agentId) {
                    connections.add(otherId);
                    node.connections.push(otherId);
                }
            }
            
            this.connections.set(agentId, connections);
        }
    }

    private async buildHierarchicalTopology(agents: string[]): Promise<void> {
        // Tree structure with coordinator at root
        const coordinator = agents.find(id => this.nodes.get(id)?.role === 'coordinator') || agents[0];
        const workers = agents.filter(id => id !== coordinator);
        
        // Coordinator connects to all workers
        const coordinatorConnections = new Set(workers);
        this.connections.set(coordinator, coordinatorConnections);
        this.nodes.get(coordinator)!.connections = workers;
        
        // Workers connect only to coordinator
        for (const workerId of workers) {
            this.connections.set(workerId, new Set([coordinator]));
            this.nodes.get(workerId)!.connections = [coordinator];
        }
    }

    private async buildRingTopology(agents: string[]): Promise<void> {
        // Circular ring - each agent connected to next and previous
        for (let i = 0; i < agents.length; i++) {
            const currentId = agents[i];
            const nextId = agents[(i + 1) % agents.length];
            const prevId = agents[(i - 1 + agents.length) % agents.length];
            
            const connections = new Set([nextId, prevId]);
            this.connections.set(currentId, connections);
            this.nodes.get(currentId)!.connections = [nextId, prevId];
        }
    }

    private async buildStarTopology(agents: string[]): Promise<void> {
        // Central hub with all others as spokes
        const hub = agents.find(id => this.nodes.get(id)?.role === 'coordinator') || agents[0];
        const spokes = agents.filter(id => id !== hub);
        
        // Hub connects to all spokes
        this.connections.set(hub, new Set(spokes));
        this.nodes.get(hub)!.connections = spokes;
        
        // Spokes connect only to hub
        for (const spokeId of spokes) {
            this.connections.set(spokeId, new Set([hub]));
            this.nodes.get(spokeId)!.connections = [hub];
        }
    }

    private determineNodeRole(agent: Agent, allAgents: Agent[]): 'coordinator' | 'worker' | 'bridge' {
        // Queen agent is always coordinator
        if (agent.type === 'coordinator' || agent.name.toLowerCase().includes('queen')) {
            return 'coordinator';
        }
        
        // Architect agents can be bridges in complex topologies
        if (agent.type === 'architect' && allAgents.length > 5) {
            return 'bridge';
        }
        
        return 'worker';
    }

    private calculateTaskComplexity(task: Task): number {
        // Simple complexity calculation
        let complexity = 0.0;
        
        // Check if task has metadata with dependencies
        if (task.metadata?.context) {
            complexity += 0.1;
        }
        
        // Estimate complexity based on task type
        if (task.type === 'generation' || task.type === 'refactoring') {
            complexity += 0.4;
        } else if (task.type === 'analysis' || task.type === 'review') {
            complexity += 0.2;
        } else if (task.type === 'optimization') {
            complexity += 0.3;
        } else if (task.type === 'testing') {
            complexity += 0.25;
        }
        
        // Add complexity based on priority
        switch (task.priority) {
            case 'critical':
                complexity += 0.3;
                break;
            case 'high':
                complexity += 0.2;
                break;
            case 'medium':
                complexity += 0.1;
                break;
            case 'low':
                complexity += 0.05;
                break;
        }
        
        return Math.min(complexity, 1.0);
    }

    private calculateAverageLoad(): number {
        const loads = Array.from(this.nodes.values()).map(n => n.load);
        return loads.length > 0 ? loads.reduce((sum, load) => sum + load, 0) / loads.length : 0;
    }

    private findDirectPath(fromAgent: string, toAgent: string): string[] {
        // In mesh topology, direct connection exists
        return [fromAgent, toAgent];
    }

    private findHierarchicalPath(fromAgent: string, toAgent: string): string[] {
        const fromNode = this.nodes.get(fromAgent);
        const toNode = this.nodes.get(toAgent);
        
        if (!fromNode || !toNode) {return [fromAgent, toAgent];}
        
        // If both are workers, go through coordinator
        if (fromNode.role === 'worker' && toNode.role === 'worker') {
            const coordinator = Array.from(this.nodes.values()).find(n => n.role === 'coordinator');
            return coordinator ? [fromAgent, coordinator.agentId, toAgent] : [fromAgent, toAgent];
        }
        
        return [fromAgent, toAgent];
    }

    private findRingPath(fromAgent: string, toAgent: string): string[] {
        const agents = Array.from(this.nodes.keys());
        const fromIndex = agents.indexOf(fromAgent);
        const toIndex = agents.indexOf(toAgent);
        
        if (fromIndex === -1 || toIndex === -1) {return [fromAgent, toAgent];}
        
        // Find shortest path around the ring
        const clockwiseDistance = (toIndex - fromIndex + agents.length) % agents.length;
        const counterClockwiseDistance = (fromIndex - toIndex + agents.length) % agents.length;
        
        const path = [fromAgent];
        
        if (clockwiseDistance <= counterClockwiseDistance) {
            // Go clockwise
            for (let i = 1; i < clockwiseDistance; i++) {
                path.push(agents[(fromIndex + i) % agents.length]);
            }
        } else {
            // Go counter-clockwise
            for (let i = 1; i < counterClockwiseDistance; i++) {
                path.push(agents[(fromIndex - i + agents.length) % agents.length]);
            }
        }
        
        path.push(toAgent);
        return path;
    }

    private findStarPath(fromAgent: string, toAgent: string): string[] {
        const hub = Array.from(this.nodes.values()).find(n => n.role === 'coordinator');
        
        if (!hub) {return [fromAgent, toAgent];}
        
        if (fromAgent === hub.agentId || toAgent === hub.agentId) {
            return [fromAgent, toAgent];
        }
        
        // Go through hub
        return [fromAgent, hub.agentId, toAgent];
    }

    private async calculateMetrics(): Promise<CoordinationMetrics> {
        const nodes = Array.from(this.nodes.values());
        const totalNodes = nodes.length;
        
        if (totalNodes === 0) {
            return {
                efficiency: 0,
                latency: 0,
                throughput: 0,
                faultTolerance: 0,
                scalability: 0
            };
        }

        // Calculate efficiency based on topology type and load distribution
        const loadVariance = this.calculateLoadVariance();
        const efficiency = Math.max(0, 1.0 - loadVariance);

        // Calculate average latency based on path lengths
        const avgPathLength = this.calculateAveragePathLength();
        const latency = Math.max(0, 1.0 - (avgPathLength - 1) / totalNodes);

        // Calculate throughput based on parallel processing capability
        const parallelCapability = this.calculateParallelCapability();
        const throughput = parallelCapability / totalNodes;

        // Calculate fault tolerance based on redundancy
        const redundancy = this.calculateRedundancy();
        const faultTolerance = Math.min(1.0, redundancy / 2);

        // Calculate scalability based on topology characteristics
        const scalability = this.calculateScalability();

        return {
            efficiency,
            latency,
            throughput,
            faultTolerance,
            scalability
        };
    }

    private calculateLoadVariance(): number {
        const loads = Array.from(this.nodes.values()).map(n => n.load);
        const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
        const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
        return Math.sqrt(variance);
    }

    private calculateAveragePathLength(): number {
        const nodes = Array.from(this.nodes.keys());
        let totalPathLength = 0;
        let pathCount = 0;

        for (const from of nodes) {
            for (const to of nodes) {
                if (from !== to) {
                    const path = this.findShortestPath(from, to);
                    totalPathLength += path.length - 1; // Subtract 1 for edge count
                    pathCount++;
                }
            }
        }

        return pathCount > 0 ? totalPathLength / pathCount : 0;
    }

    private findShortestPath(from: string, to: string): string[] {
        // Simple BFS for shortest path
        const queue = [[from]];
        const visited = new Set([from]);

        while (queue.length > 0) {
            const path = queue.shift()!;
            const current = path[path.length - 1];

            if (current === to) {
                return path;
            }

            const connections = this.connections.get(current) || new Set();
            for (const neighbor of connections) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }

        return [from, to]; // Fallback direct path
    }

    private calculateParallelCapability(): number {
        switch (this.currentTopology) {
            case 'mesh':
                return this.nodes.size; // All agents can work in parallel
            case 'hierarchical':
                return Math.max(1, this.nodes.size - 1); // All workers can work in parallel
            case 'ring':
                return Math.ceil(this.nodes.size / 2); // Limited parallel capability
            case 'star':
                return Math.max(1, this.nodes.size - 1); // All spokes can work in parallel
            default:
                return 1;
        }
    }

    private calculateRedundancy(): number {
        // Calculate average number of alternative paths
        const nodes = Array.from(this.nodes.keys());
        let totalRedundancy = 0;

        for (const nodeId of nodes) {
            const connections = this.connections.get(nodeId)?.size || 0;
            totalRedundancy += connections;
        }

        return nodes.length > 0 ? totalRedundancy / nodes.length : 0;
    }

    private calculateScalability(): number {
        const nodeCount = this.nodes.size;
        
        switch (this.currentTopology) {
            case 'mesh':
                // Mesh doesn't scale well due to O(n²) connections
                return Math.max(0, 1.0 - (nodeCount * nodeCount) / (this.topologyConfig.maxAgents * this.topologyConfig.maxAgents));
            case 'hierarchical':
                // Hierarchical scales well
                return Math.min(1.0, 1.0 - nodeCount / this.topologyConfig.maxAgents);
            case 'ring':
                // Ring scales moderately
                return Math.min(1.0, 0.8 - nodeCount / this.topologyConfig.maxAgents);
            case 'star':
                // Star scales well but limited by central hub
                return Math.min(1.0, 0.9 - nodeCount / this.topologyConfig.maxAgents);
            default:
                return 0.5;
        }
    }

    private async updateMetrics(): Promise<void> {
        this.metrics = await this.calculateMetrics();
    }

    private calculateOverallScore(metrics: CoordinationMetrics): number {
        // Weighted score combining all metrics
        return (
            metrics.efficiency * 0.3 +
            metrics.latency * 0.2 +
            metrics.throughput * 0.25 +
            metrics.faultTolerance * 0.15 +
            metrics.scalability * 0.1
        );
    }

    private async generateOptimizations(): Promise<any[]> {
        // Generate potential optimizations based on current topology
        const optimizations = [];

        // Load balancing optimization
        if (this.calculateLoadVariance() > 0.3) {
            optimizations.push({
                type: 'load_balancing',
                description: 'Redistribute load across agents'
            });
        }

        // Connection optimization
        if (this.currentTopology === 'mesh' && this.nodes.size > 6) {
            optimizations.push({
                type: 'reduce_connections',
                description: 'Reduce unnecessary connections in mesh'
            });
        }

        // Role optimization
        const coordinators = Array.from(this.nodes.values()).filter(n => n.role === 'coordinator');
        if (coordinators.length === 0 && this.nodes.size > 3) {
            optimizations.push({
                type: 'add_coordinator',
                description: 'Add coordinator role for better organization'
            });
        }

        return optimizations;
    }

    private async simulateOptimization(optimization: any): Promise<CoordinationMetrics> {
        // Simulate the optimization and return predicted metrics
        // This is a simplified simulation - in practice, this would be more sophisticated
        const currentMetrics = { ...this.metrics };

        switch (optimization.type) {
            case 'load_balancing':
                currentMetrics.efficiency += 0.1;
                currentMetrics.throughput += 0.05;
                break;
            case 'reduce_connections':
                currentMetrics.scalability += 0.15;
                currentMetrics.latency += 0.05;
                break;
            case 'add_coordinator':
                currentMetrics.efficiency += 0.08;
                currentMetrics.faultTolerance += 0.1;
                break;
        }

        // Ensure metrics stay within bounds
        Object.keys(currentMetrics).forEach(key => {
            currentMetrics[key as keyof CoordinationMetrics] = Math.min(1.0, Math.max(0.0, currentMetrics[key as keyof CoordinationMetrics]));
        });

        return currentMetrics;
    }

    private async applyOptimization(optimization: any): Promise<void> {
        this.outputChannel.appendLine(`🔧 Applying optimization: ${optimization.description}`);

        switch (optimization.type) {
            case 'load_balancing':
                await this.rebalanceLoad();
                break;
            case 'reduce_connections':
                await this.optimizeConnections();
                break;
            case 'add_coordinator':
                await this.promoteToCoordinator();
                break;
        }

        await this.updateMetrics();
    }

    private async rebalanceLoad(): Promise<void> {
        // Redistribute load more evenly across agents
        const nodes = Array.from(this.nodes.values());
        const totalLoad = nodes.reduce((sum, node) => sum + node.load, 0);
        const targetLoad = totalLoad / nodes.length;

        for (const node of nodes) {
            node.load = targetLoad;
        }
    }

    private async optimizeConnections(): Promise<void> {
        // Remove redundant connections in mesh topology
        if (this.currentTopology === 'mesh' && this.nodes.size > 6) {
            // Convert to hierarchical for better scalability
            await this.buildHierarchicalTopology(Array.from(this.nodes.keys()));
        }
    }

    private async promoteToCoordinator(): Promise<void> {
        // Promote the most suitable agent to coordinator role
        const workers = Array.from(this.nodes.values()).filter(n => n.role === 'worker');
        if (workers.length > 0) {
            // Choose agent with lowest load and good performance
            const bestCandidate = workers.reduce((best, current) => 
                current.load < best.load ? current : best
            );
            
            bestCandidate.role = 'coordinator';
            this.outputChannel.appendLine(`👑 Promoted agent ${bestCandidate.agentId} to coordinator`);
        }
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
