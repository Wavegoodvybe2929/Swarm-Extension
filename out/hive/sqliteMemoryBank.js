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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteMemoryBank = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const writeFile = (0, util_1.promisify)(fs.writeFile);
const readFile = (0, util_1.promisify)(fs.readFile);
const mkdir = (0, util_1.promisify)(fs.mkdir);
const access = (0, util_1.promisify)(fs.access);
class SQLiteMemoryBank {
    constructor(storagePath, maxSizeMB = 1024, enableCompression = true) {
        this.isInitialized = false;
        this.dbPath = path.join(storagePath, 'hive-memory.db');
        this.maxMemorySize = maxSizeMB * 1024 * 1024; // Convert to bytes
        this.compressionEnabled = enableCompression;
    }
    async initialize() {
        try {
            // Ensure storage directory exists
            const storageDir = path.dirname(this.dbPath);
            try {
                await access(storageDir);
            }
            catch {
                await mkdir(storageDir, { recursive: true });
            }
            // Initialize SQLite database
            this.db = new better_sqlite3_1.default(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 10000');
            this.db.pragma('temp_store = MEMORY');
            // Create tables
            await this.createTables();
            // Create indexes for performance
            await this.createIndexes();
            // Migrate existing JSON data if present
            await this.migrateFromJSON();
            this.isInitialized = true;
            // Start periodic cleanup
            this.startPeriodicCleanup();
        }
        catch (error) {
            throw new Error(`Failed to initialize SQLite memory bank: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async createTables() {
        const tables = [
            // 1. Swarm State - Current hive status and configuration
            `CREATE TABLE IF NOT EXISTS swarm_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                topology TEXT NOT NULL,
                active_agents INTEGER DEFAULT 0,
                total_agents INTEGER DEFAULT 0,
                active_tasks INTEGER DEFAULT 0,
                completed_tasks INTEGER DEFAULT 0,
                configuration TEXT, -- JSON configuration
                health_status TEXT DEFAULT 'offline',
                memory_usage REAL DEFAULT 0.0,
                cpu_usage REAL DEFAULT 0.0
            )`,
            // 2. Agent Interactions - Inter-agent communication logs
            `CREATE TABLE IF NOT EXISTS agent_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                from_agent_id TEXT NOT NULL,
                to_agent_id TEXT,
                interaction_type TEXT NOT NULL, -- 'message', 'coordination', 'handoff'
                content TEXT,
                success BOOLEAN DEFAULT TRUE,
                duration_ms INTEGER,
                metadata TEXT -- JSON metadata
            )`,
            // 3. Task History - Completed tasks and outcomes
            `CREATE TABLE IF NOT EXISTS task_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT UNIQUE NOT NULL,
                specification_id TEXT,
                agent_id TEXT NOT NULL,
                task_type TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                completed_at DATETIME,
                duration_ms INTEGER,
                success BOOLEAN,
                output TEXT,
                error_message TEXT,
                token_usage INTEGER,
                complexity_score REAL
            )`,
            // 4. Decision Tree - Decision-making patterns and rationale
            `CREATE TABLE IF NOT EXISTS decision_tree (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                decision_context TEXT NOT NULL,
                decision_type TEXT NOT NULL, -- 'agent_assignment', 'topology_switch', 'resource_allocation'
                input_factors TEXT, -- JSON array of factors considered
                decision_made TEXT NOT NULL,
                confidence_score REAL,
                outcome_success BOOLEAN,
                learning_feedback TEXT,
                agent_id TEXT
            )`,
            // 5. Performance Metrics - Execution time, success rates, efficiency
            `CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                metric_type TEXT NOT NULL, -- 'agent', 'task', 'system'
                entity_id TEXT NOT NULL, -- agent_id, task_id, or 'system'
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                unit TEXT,
                context TEXT, -- JSON context data
                aggregation_period TEXT -- 'instant', 'hourly', 'daily'
            )`,
            // 6. Neural Patterns - Learned coordination patterns
            `CREATE TABLE IF NOT EXISTS neural_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                pattern_type TEXT NOT NULL, -- 'coordination', 'optimization', 'error_recovery'
                pattern_name TEXT NOT NULL,
                pattern_data TEXT NOT NULL, -- JSON pattern structure
                usage_count INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0.0,
                last_used DATETIME,
                effectiveness_score REAL,
                context_tags TEXT -- JSON array of context tags
            )`,
            // 7. Code Patterns - Successful code implementations
            `CREATE TABLE IF NOT EXISTS code_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                pattern_name TEXT NOT NULL,
                language TEXT NOT NULL,
                pattern_type TEXT NOT NULL, -- 'function', 'class', 'module', 'algorithm'
                code_snippet TEXT NOT NULL,
                description TEXT,
                usage_context TEXT,
                success_metrics TEXT, -- JSON metrics
                file_path TEXT,
                project_context TEXT,
                tags TEXT -- JSON array of tags
            )`,
            // 8. Error Patterns - Common mistakes and their solutions
            `CREATE TABLE IF NOT EXISTS error_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                error_type TEXT NOT NULL,
                error_message TEXT NOT NULL,
                error_context TEXT, -- JSON context where error occurred
                solution TEXT,
                prevention_strategy TEXT,
                occurrence_count INTEGER DEFAULT 1,
                last_occurrence DATETIME DEFAULT CURRENT_TIMESTAMP,
                severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
                resolution_time_ms INTEGER,
                agent_id TEXT
            )`,
            // 9. Project Context - Current project state and requirements
            `CREATE TABLE IF NOT EXISTS project_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                project_id TEXT NOT NULL,
                context_type TEXT NOT NULL, -- 'requirements', 'architecture', 'dependencies', 'constraints'
                context_data TEXT NOT NULL, -- JSON context data
                relevance_score REAL DEFAULT 1.0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                source TEXT, -- 'user_input', 'analysis', 'inference'
                validation_status TEXT DEFAULT 'pending' -- 'pending', 'validated', 'outdated'
            )`,
            // 10. File Changes - Tracked file modifications and reasons
            `CREATE TABLE IF NOT EXISTS file_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                file_path TEXT NOT NULL,
                change_type TEXT NOT NULL, -- 'created', 'modified', 'deleted', 'renamed'
                agent_id TEXT,
                task_id TEXT,
                change_reason TEXT,
                diff_data TEXT, -- Compressed diff data
                file_size_before INTEGER,
                file_size_after INTEGER,
                lines_added INTEGER DEFAULT 0,
                lines_removed INTEGER DEFAULT 0,
                complexity_impact REAL
            )`,
            // 11. Dependencies - Project dependencies and relationships
            `CREATE TABLE IF NOT EXISTS dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                dependency_type TEXT NOT NULL, -- 'npm', 'pip', 'maven', 'internal'
                name TEXT NOT NULL,
                version TEXT,
                source TEXT, -- 'package.json', 'requirements.txt', etc.
                usage_context TEXT, -- Where and how it's used
                security_status TEXT DEFAULT 'unknown',
                last_updated DATETIME,
                impact_score REAL DEFAULT 0.0,
                relationship_data TEXT -- JSON relationship mapping
            )`,
            // 12. Documentation - Generated docs and explanations
            `CREATE TABLE IF NOT EXISTS documentation (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                doc_type TEXT NOT NULL, -- 'api', 'readme', 'comment', 'explanation'
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                file_path TEXT,
                agent_id TEXT,
                task_id TEXT,
                format TEXT DEFAULT 'markdown', -- 'markdown', 'html', 'plain'
                quality_score REAL,
                last_reviewed DATETIME,
                review_status TEXT DEFAULT 'pending' -- 'pending', 'approved', 'needs_update'
            )`
        ];
        for (const tableSQL of tables) {
            this.db.exec(tableSQL);
        }
    }
    async createIndexes() {
        const indexes = [
            // Swarm State indexes
            'CREATE INDEX IF NOT EXISTS idx_swarm_state_timestamp ON swarm_state(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_swarm_state_health ON swarm_state(health_status)',
            // Agent Interactions indexes
            'CREATE INDEX IF NOT EXISTS idx_agent_interactions_timestamp ON agent_interactions(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_agent_interactions_from ON agent_interactions(from_agent_id)',
            'CREATE INDEX IF NOT EXISTS idx_agent_interactions_to ON agent_interactions(to_agent_id)',
            'CREATE INDEX IF NOT EXISTS idx_agent_interactions_type ON agent_interactions(interaction_type)',
            // Task History indexes
            'CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id)',
            'CREATE INDEX IF NOT EXISTS idx_task_history_agent_id ON task_history(agent_id)',
            'CREATE INDEX IF NOT EXISTS idx_task_history_status ON task_history(status)',
            'CREATE INDEX IF NOT EXISTS idx_task_history_created ON task_history(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_task_history_spec_id ON task_history(specification_id)',
            // Decision Tree indexes
            'CREATE INDEX IF NOT EXISTS idx_decision_tree_timestamp ON decision_tree(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_decision_tree_type ON decision_tree(decision_type)',
            'CREATE INDEX IF NOT EXISTS idx_decision_tree_agent ON decision_tree(agent_id)',
            // Performance Metrics indexes
            'CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type)',
            'CREATE INDEX IF NOT EXISTS idx_performance_metrics_entity ON performance_metrics(entity_id)',
            'CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name)',
            // Neural Patterns indexes
            'CREATE INDEX IF NOT EXISTS idx_neural_patterns_type ON neural_patterns(pattern_type)',
            'CREATE INDEX IF NOT EXISTS idx_neural_patterns_name ON neural_patterns(pattern_name)',
            'CREATE INDEX IF NOT EXISTS idx_neural_patterns_usage ON neural_patterns(usage_count)',
            'CREATE INDEX IF NOT EXISTS idx_neural_patterns_success ON neural_patterns(success_rate)',
            // Code Patterns indexes
            'CREATE INDEX IF NOT EXISTS idx_code_patterns_language ON code_patterns(language)',
            'CREATE INDEX IF NOT EXISTS idx_code_patterns_type ON code_patterns(pattern_type)',
            'CREATE INDEX IF NOT EXISTS idx_code_patterns_name ON code_patterns(pattern_name)',
            // Error Patterns indexes
            'CREATE INDEX IF NOT EXISTS idx_error_patterns_type ON error_patterns(error_type)',
            'CREATE INDEX IF NOT EXISTS idx_error_patterns_count ON error_patterns(occurrence_count)',
            'CREATE INDEX IF NOT EXISTS idx_error_patterns_severity ON error_patterns(severity)',
            // Project Context indexes
            'CREATE INDEX IF NOT EXISTS idx_project_context_project ON project_context(project_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_context_type ON project_context(context_type)',
            'CREATE INDEX IF NOT EXISTS idx_project_context_relevance ON project_context(relevance_score)',
            // File Changes indexes
            'CREATE INDEX IF NOT EXISTS idx_file_changes_path ON file_changes(file_path)',
            'CREATE INDEX IF NOT EXISTS idx_file_changes_type ON file_changes(change_type)',
            'CREATE INDEX IF NOT EXISTS idx_file_changes_agent ON file_changes(agent_id)',
            'CREATE INDEX IF NOT EXISTS idx_file_changes_task ON file_changes(task_id)',
            // Dependencies indexes
            'CREATE INDEX IF NOT EXISTS idx_dependencies_type ON dependencies(dependency_type)',
            'CREATE INDEX IF NOT EXISTS idx_dependencies_name ON dependencies(name)',
            'CREATE INDEX IF NOT EXISTS idx_dependencies_security ON dependencies(security_status)',
            // Documentation indexes
            'CREATE INDEX IF NOT EXISTS idx_documentation_type ON documentation(doc_type)',
            'CREATE INDEX IF NOT EXISTS idx_documentation_path ON documentation(file_path)',
            'CREATE INDEX IF NOT EXISTS idx_documentation_agent ON documentation(agent_id)',
            'CREATE INDEX IF NOT EXISTS idx_documentation_quality ON documentation(quality_score)'
        ];
        for (const indexSQL of indexes) {
            this.db.exec(indexSQL);
        }
    }
    async storeSpecification(spec) {
        this.ensureInitialized();
        const transaction = this.db.transaction(() => {
            // Store in task_history
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO task_history 
                (task_id, specification_id, agent_id, task_type, description, status, created_at, complexity_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(spec.id, spec.id, 'system', 'specification', spec.title, 'pending', new Date().toISOString(), this.calculateComplexity(spec));
            // Store project context
            const contextStmt = this.db.prepare(`
                INSERT INTO project_context 
                (project_id, context_type, context_data, relevance_score, source)
                VALUES (?, ?, ?, ?, ?)
            `);
            contextStmt.run(spec.id, 'requirements', JSON.stringify(spec.requirements), 1.0, 'specification');
            contextStmt.run(spec.id, 'architecture', JSON.stringify(spec.architecture || {}), 0.8, 'specification');
        });
        transaction();
    }
    async storeExecutionResult(specId, result) {
        this.ensureInitialized();
        const transaction = this.db.transaction(() => {
            // Update task_history
            const updateStmt = this.db.prepare(`
                UPDATE task_history 
                SET status = ?, completed_at = ?, duration_ms = ?, success = ?, output = ?, error_message = ?
                WHERE specification_id = ?
            `);
            updateStmt.run(result.success ? 'completed' : 'failed', new Date().toISOString(), result.duration, result.success, result.output, result.error || null, specId);
            // Store performance metrics
            if (result.metrics) {
                const perfStmt = this.db.prepare(`
                    INSERT INTO performance_metrics 
                    (metric_type, entity_id, metric_name, metric_value, unit, context)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                perfStmt.run('task', specId, 'duration_ms', result.duration, 'milliseconds', JSON.stringify(result.metrics));
                perfStmt.run('task', specId, 'success_rate', result.success ? 1.0 : 0.0, 'ratio', JSON.stringify(result.metrics));
                if (result.metrics.tokenUsage) {
                    perfStmt.run('task', specId, 'token_usage', result.metrics.tokenUsage, 'tokens', JSON.stringify(result.metrics));
                }
            }
        });
        transaction();
    }
    async storeAgentCreation(agent) {
        this.ensureInitialized();
        const transaction = this.db.transaction(() => {
            // Store in task_history as agent creation event
            const taskStmt = this.db.prepare(`
                INSERT INTO task_history 
                (task_id, agent_id, task_type, description, status, created_at, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            taskStmt.run(`agent-creation-${agent.id}`, agent.id, 'agent_creation', `Created ${agent.type} agent: ${agent.name}`, 'completed', agent.createdAt.toISOString(), true);
            // Store initial performance metrics
            const perfStmt = this.db.prepare(`
                INSERT INTO performance_metrics 
                (metric_type, entity_id, metric_name, metric_value, unit)
                VALUES (?, ?, ?, ?, ?)
            `);
            perfStmt.run('agent', agent.id, 'tasks_completed', agent.performance.tasksCompleted, 'count');
            perfStmt.run('agent', agent.id, 'success_rate', agent.performance.successRate, 'ratio');
            perfStmt.run('agent', agent.id, 'avg_response_time', agent.performance.averageResponseTime, 'milliseconds');
            perfStmt.run('agent', agent.id, 'token_efficiency', agent.performance.tokenEfficiency, 'ratio');
            perfStmt.run('agent', agent.id, 'accuracy', agent.performance.accuracy, 'ratio');
        });
        transaction();
    }
    async storeTaskExecution(taskId, agentId, result) {
        this.ensureInitialized();
        const transaction = this.db.transaction(() => {
            // Store/update in task_history
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO task_history 
                (task_id, agent_id, task_type, description, status, completed_at, duration_ms, success, output, error_message, token_usage)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(taskId, agentId, result.type || 'execution', result.description || 'Task execution', result.success ? 'completed' : 'failed', new Date().toISOString(), result.duration, result.success, result.output, result.error || null, result.tokenUsage || null);
            // Update agent performance metrics
            const perfStmt = this.db.prepare(`
                INSERT INTO performance_metrics 
                (metric_type, entity_id, metric_name, metric_value, unit, context)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const context = JSON.stringify({ taskId, timestamp: new Date().toISOString() });
            perfStmt.run('agent', agentId, 'task_duration', result.duration, 'milliseconds', context);
            perfStmt.run('agent', agentId, 'task_success', result.success ? 1.0 : 0.0, 'ratio', context);
            if (result.tokenUsage) {
                perfStmt.run('agent', agentId, 'token_usage', result.tokenUsage, 'tokens', context);
            }
        });
        transaction();
    }
    async getCompletedTaskCount() {
        this.ensureInitialized();
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM task_history 
            WHERE status = 'completed' AND success = 1
        `);
        const result = stmt.get();
        return result.count;
    }
    async getSize() {
        this.ensureInitialized();
        try {
            const stats = fs.statSync(this.dbPath);
            const sizeInMB = stats.size / (1024 * 1024);
            return `${sizeInMB.toFixed(2)} MB`;
        }
        catch {
            return '0 MB';
        }
    }
    async query(query, limit = 100) {
        this.ensureInitialized();
        const results = [];
        const queryLower = query.toLowerCase();
        const searchTerms = queryLower.split(' ').filter(term => term.length > 2);
        // Search across multiple tables
        const searches = [
            {
                table: 'task_history',
                fields: ['description', 'output', 'error_message'],
                type: 'task'
            },
            {
                table: 'agent_interactions',
                fields: ['content'],
                type: 'interaction'
            },
            {
                table: 'code_patterns',
                fields: ['pattern_name', 'description', 'code_snippet'],
                type: 'code_pattern'
            },
            {
                table: 'error_patterns',
                fields: ['error_message', 'solution', 'prevention_strategy'],
                type: 'error_pattern'
            },
            {
                table: 'documentation',
                fields: ['title', 'content'],
                type: 'documentation'
            }
        ];
        for (const search of searches) {
            const conditions = search.fields.map(field => searchTerms.map(term => `${field} LIKE '%${term}%'`).join(' OR ')).join(' OR ');
            if (conditions) {
                const stmt = this.db.prepare(`
                    SELECT *, '${search.type}' as result_type 
                    FROM ${search.table} 
                    WHERE ${conditions}
                    ORDER BY timestamp DESC 
                    LIMIT ?
                `);
                const tableResults = stmt.all(Math.floor(limit / searches.length));
                results.push(...tableResults.map((row) => ({
                    ...row,
                    relevance: this.calculateRelevance(row, searchTerms)
                })));
            }
        }
        // Sort by relevance and limit
        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }
    async getAgentContext(agentId) {
        this.ensureInitialized();
        // Get recent tasks
        const tasksStmt = this.db.prepare(`
            SELECT * FROM task_history 
            WHERE agent_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        const recentTasks = tasksStmt.all(agentId);
        // Get recent interactions
        const interactionsStmt = this.db.prepare(`
            SELECT * FROM agent_interactions 
            WHERE from_agent_id = ? OR to_agent_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 10
        `);
        const recentInteractions = interactionsStmt.all(agentId, agentId);
        // Get performance metrics
        const metricsStmt = this.db.prepare(`
            SELECT metric_name, AVG(metric_value) as avg_value, MAX(timestamp) as last_updated
            FROM performance_metrics 
            WHERE entity_id = ? AND metric_type = 'agent'
            GROUP BY metric_name
        `);
        const performanceMetrics = metricsStmt.all(agentId);
        return {
            agentId,
            recentTasks,
            recentInteractions,
            performanceMetrics,
            lastActive: recentTasks[0]?.completed_at || recentInteractions[0]?.timestamp
        };
    }
    async checkHealth() {
        const issues = [];
        try {
            // Check if initialized
            if (!this.isInitialized) {
                issues.push('Memory bank not initialized');
                return { healthy: false, issues };
            }
            // Check database accessibility
            try {
                this.db.prepare('SELECT 1').get();
            }
            catch (error) {
                issues.push('Database not accessible');
            }
            // Check database size
            try {
                const stats = fs.statSync(this.dbPath);
                if (stats.size > this.maxMemorySize) {
                    issues.push(`Database size (${stats.size}) exceeds limit (${this.maxMemorySize})`);
                }
            }
            catch (error) {
                issues.push('Cannot check database size');
            }
            // Check table integrity
            const tables = [
                'swarm_state', 'agent_interactions', 'task_history', 'decision_tree',
                'performance_metrics', 'neural_patterns', 'code_patterns', 'error_patterns',
                'project_context', 'file_changes', 'dependencies', 'documentation'
            ];
            for (const table of tables) {
                try {
                    this.db.prepare(`SELECT COUNT(*) FROM ${table}`).get();
                }
                catch (error) {
                    issues.push(`Table ${table} is corrupted or missing`);
                }
            }
        }
        catch (error) {
            issues.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        return {
            healthy: issues.length === 0,
            issues
        };
    }
    // Advanced query methods for specialized tables
    async storeNeuralPattern(pattern) {
        this.ensureInitialized();
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO neural_patterns 
            (pattern_type, pattern_name, pattern_data, context_tags, usage_count, success_rate, last_used, effectiveness_score)
            VALUES (?, ?, ?, ?, 0, 0.0, CURRENT_TIMESTAMP, 0.0)
        `);
        stmt.run(pattern.type, pattern.name, JSON.stringify(pattern.data), JSON.stringify(pattern.contextTags));
    }
    async getNeuralPatterns(type, limit = 50) {
        this.ensureInitialized();
        let stmt;
        if (type) {
            stmt = this.db.prepare(`
                SELECT * FROM neural_patterns 
                WHERE pattern_type = ? 
                ORDER BY effectiveness_score DESC, usage_count DESC 
                LIMIT ?
            `);
            return stmt.all(type, limit);
        }
        else {
            stmt = this.db.prepare(`
                SELECT * FROM neural_patterns 
                ORDER BY effectiveness_score DESC, usage_count DESC 
                LIMIT ?
            `);
            return stmt.all(limit);
        }
    }
    async storeCodePattern(pattern) {
        this.ensureInitialized();
        const stmt = this.db.prepare(`
            INSERT INTO code_patterns 
            (pattern_name, language, pattern_type, code_snippet, description, usage_context, file_path, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(pattern.name, pattern.language, pattern.type, pattern.code, pattern.description, pattern.context, pattern.filePath || null, JSON.stringify(pattern.tags));
    }
    async getCodePatterns(language, type, limit = 50) {
        this.ensureInitialized();
        let whereClause = '';
        const params = [];
        if (language) {
            whereClause += 'WHERE language = ?';
            params.push(language);
        }
        if (type) {
            whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'pattern_type = ?';
            params.push(type);
        }
        params.push(limit);
        const stmt = this.db.prepare(`
            SELECT * FROM code_patterns 
            ${whereClause}
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        return stmt.all(...params);
    }
    async storeErrorPattern(error) {
        this.ensureInitialized();
        // Check if error pattern already exists
        const existingStmt = this.db.prepare(`
            SELECT id, occurrence_count FROM error_patterns 
            WHERE error_type = ? AND error_message = ?
        `);
        const existing = existingStmt.get(error.type, error.message);
        if (existing) {
            // Update existing pattern
            const updateStmt = this.db.prepare(`
                UPDATE error_patterns 
                SET occurrence_count = ?, last_occurrence = CURRENT_TIMESTAMP, solution = ?, prevention_strategy = ?
                WHERE id = ?
            `);
            updateStmt.run(existing.occurrence_count + 1, error.solution || null, error.prevention || null, existing.id);
        }
        else {
            // Insert new pattern
            const insertStmt = this.db.prepare(`
                INSERT INTO error_patterns 
                (error_type, error_message, error_context, solution, prevention_strategy, severity, agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            insertStmt.run(error.type, error.message, JSON.stringify(error.context), error.solution || null, error.prevention || null, error.severity, error.agentId || null);
        }
    }
    async getErrorPatterns(type, severity, limit = 50) {
        this.ensureInitialized();
        let whereClause = '';
        const params = [];
        if (type) {
            whereClause += 'WHERE error_type = ?';
            params.push(type);
        }
        if (severity) {
            whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'severity = ?';
            params.push(severity);
        }
        params.push(limit);
        const stmt = this.db.prepare(`
            SELECT * FROM error_patterns 
            ${whereClause}
            ORDER BY occurrence_count DESC, last_occurrence DESC 
            LIMIT ?
        `);
        return stmt.all(...params);
    }
    async storeDecision(decision) {
        this.ensureInitialized();
        const stmt = this.db.prepare(`
            INSERT INTO decision_tree 
            (decision_context, decision_type, input_factors, decision_made, confidence_score, agent_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(decision.context, decision.type, JSON.stringify(decision.inputFactors), decision.decisionMade, decision.confidence, decision.agentId || null);
    }
    async storeFileChange(change) {
        this.ensureInitialized();
        const stmt = this.db.prepare(`
            INSERT INTO file_changes 
            (file_path, change_type, agent_id, task_id, change_reason, diff_data, file_size_before, file_size_after, lines_added, lines_removed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(change.filePath, change.changeType, change.agentId || null, change.taskId || null, change.reason || null, change.diffData || null, change.sizeBefore || null, change.sizeAfter || null, change.linesAdded || 0, change.linesRemoved || 0);
    }
    async storeSwarmState(state) {
        this.ensureInitialized();
        const stmt = this.db.prepare(`
            INSERT INTO swarm_state 
            (topology, active_agents, total_agents, active_tasks, completed_tasks, configuration, health_status, memory_usage, cpu_usage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(state.topology, state.activeAgents, state.totalAgents, state.activeTasks, state.completedTasks, JSON.stringify(state.configuration), state.healthStatus, state.memoryUsage, state.cpuUsage);
    }
    async getLatestSwarmState() {
        this.ensureInitialized();
        const stmt = this.db.prepare(`
            SELECT * FROM swarm_state 
            ORDER BY timestamp DESC 
            LIMIT 1
        `);
        return stmt.get();
    }
    async migrateFromJSON() {
        // Check if old JSON file exists and migrate data
        const jsonPath = path.join(path.dirname(this.dbPath), 'hive-memory.json');
        try {
            await access(jsonPath);
            const jsonData = await readFile(jsonPath, 'utf8');
            const oldData = JSON.parse(jsonData);
            // Migrate specifications
            if (oldData.specifications) {
                for (const [id, spec] of Object.entries(oldData.specifications)) {
                    const specEntry = spec;
                    if (specEntry.specification) {
                        await this.storeSpecification(specEntry.specification);
                    }
                }
            }
            // Migrate agents
            if (oldData.agents) {
                for (const [id, agentEntry] of Object.entries(oldData.agents)) {
                    const entry = agentEntry;
                    if (entry.agent) {
                        await this.storeAgentCreation(entry.agent);
                    }
                }
            }
            // Migrate task executions
            if (oldData.taskExecutions) {
                for (const [id, taskEntry] of Object.entries(oldData.taskExecutions)) {
                    const entry = taskEntry;
                    if (entry.taskId && entry.agentId && entry.result) {
                        await this.storeTaskExecution(entry.taskId, entry.agentId, entry.result);
                    }
                }
            }
            console.log('Successfully migrated data from JSON to SQLite');
            // Optionally backup and remove old JSON file
            // await writeFile(jsonPath + '.backup', jsonData);
            // await fs.promises.unlink(jsonPath);
        }
        catch (error) {
            // JSON file doesn't exist or migration failed - that's okay
            console.log('No JSON data to migrate or migration failed:', error);
        }
    }
    startPeriodicCleanup() {
        // Run cleanup every hour
        setInterval(() => {
            this.performCleanup().catch(console.error);
        }, 60 * 60 * 1000);
    }
    async performCleanup() {
        try {
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
            const cutoffDate = new Date(Date.now() - maxAge).toISOString();
            // Clean old performance metrics
            const cleanupStmt = this.db.prepare(`
                DELETE FROM performance_metrics 
                WHERE timestamp < ? AND aggregation_period = 'instant'
            `);
            cleanupStmt.run(cutoffDate);
            // Clean old agent interactions
            const interactionCleanup = this.db.prepare(`
                DELETE FROM agent_interactions 
                WHERE timestamp < ?
            `);
            interactionCleanup.run(cutoffDate);
            // Clean old swarm states (keep only latest 1000)
            const stateCleanup = this.db.prepare(`
                DELETE FROM swarm_state 
                WHERE id NOT IN (
                    SELECT id FROM swarm_state 
                    ORDER BY timestamp DESC 
                    LIMIT 1000
                )
            `);
            stateCleanup.run();
            // Vacuum database to reclaim space
            this.db.exec('VACUUM');
        }
        catch (error) {
            console.error('Memory cleanup failed:', error);
        }
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('SQLite memory bank not initialized');
        }
    }
    calculateComplexity(spec) {
        // Simple complexity calculation based on requirements and tasks
        const requirementComplexity = spec.requirements.length * 0.2;
        const taskComplexity = spec.tasks.length * 0.3;
        const dependencyComplexity = spec.dependencies.length * 0.1;
        return Math.min(requirementComplexity + taskComplexity + dependencyComplexity, 1.0);
    }
    calculateRelevance(row, searchTerms) {
        const searchText = JSON.stringify(row).toLowerCase();
        let relevance = 0;
        for (const term of searchTerms) {
            const occurrences = (searchText.match(new RegExp(term, 'g')) || []).length;
            relevance += occurrences;
        }
        return relevance;
    }
    dispose() {
        if (this.db) {
            this.db.close();
        }
    }
}
exports.SQLiteMemoryBank = SQLiteMemoryBank;
//# sourceMappingURL=sqliteMemoryBank.js.map