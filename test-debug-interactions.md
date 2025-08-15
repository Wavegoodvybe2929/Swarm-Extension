# Debug Testing Script

This script provides step-by-step instructions for testing the RUV-Swarm extension debugging setup.

## 🚀 Launch Extension for Debugging

### Step 1: Start Debug Session
1. **Press F5** in VSCode (or Run → Start Debugging)
2. **Select "Run Extension (Debug Mode)"** from the dropdown
3. **Wait for Extension Development Host window** to open
4. **Open Debug Console** in main window: View → Debug Console

### Step 2: Verify Extension Activation
Look for these debug messages in the Debug Console:
```
🧠 RUV-Swarm extension is now active!
📊 DEBUG: Extension activation started at: [timestamp]
📊 DEBUG: VSCode version: [version]
📊 DEBUG: Initializing ErrorHandler...
📊 DEBUG: Initializing ProgressManager...
📊 DEBUG: Initializing CLIValidator...
📊 DEBUG: Initializing StatusBarManager...
📊 DEBUG: Initializing SwarmManager...
📊 DEBUG: Initializing DiagnosticsProvider...
📊 DEBUG: Initializing CommandQueue...
📊 DEBUG: Initializing BatchProcessor...
📊 DEBUG: Initializing CommandManager...
📊 DEBUG: Initializing FileWatcher...
📊 DEBUG: Initializing WebviewProvider...
📊 DEBUG: Starting CLI validation...
📊 DEBUG: CLI validation result: [result]
📊 DEBUG: Registering commands...
📊 DEBUG: Registering providers...
📊 DEBUG: Initializing file watcher...
📊 DEBUG: Extension configuration: [config]
📊 DEBUG: Extension activation completed successfully
```

## 🧪 Test User Interactions

### Test 1: Command Palette Interactions
1. **In Extension Development Host window**: Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. **Type "RUV-Swarm"** to filter commands
3. **Select "RUV-Swarm: Initialize AI Swarm"**
4. **Check Debug Console** for:
   ```
   🎯 DEBUG: User executed command: initializeSwarm
   ```

### Test 2: File Analysis Command
1. **Open a TypeScript/JavaScript file** in Extension Development Host
2. **Press `Ctrl+Shift+A R`** (or use Command Palette → "RUV-Swarm: Analyze Current File")
3. **Check Debug Console** for:
   ```
   🎯 DEBUG: User executed command: analyzeCurrentFile
   🎯 DEBUG: Active editor file: [file path]
   ```

### Test 3: Code Explanation with Selection
1. **Select some code** in the active editor
2. **Right-click** and look for RUV-Swarm context menu options
3. **Select "Explain Code"** or use `Ctrl+Shift+A E`
4. **Check Debug Console** for:
   ```
   🎯 DEBUG: User executed command: explainCode
   🎯 DEBUG: Selected text range: [selection details]
   ```

### Test 4: Dashboard Interaction
1. **Look for brain icon (🧠)** in Activity Bar
2. **Click the brain icon** to open RUV-Swarm panel
3. **Use Command Palette** → "RUV-Swarm: Open Dashboard"
4. **Check Debug Console** for:
   ```
   🎯 DEBUG: User executed command: openDashboard
   ```

### Test 5: CLI Validation
1. **Use Command Palette** → "RUV-Swarm: Validate CLI Environment"
2. **Check Debug Console** for:
   ```
   🎯 DEBUG: User executed command: validateCLI
   🎯 DEBUG: CLI validation result: [detailed result]
   ```

### Test 6: Error Reporting
1. **Use Command Palette** → "RUV-Swarm: Show Error Reports"
2. **Check if output channel opens** with error reports
3. **Monitor Debug Console** for error handling logs

### Test 7: Command Queue Monitoring
1. **Use Command Palette** → "RUV-Swarm: Show Command Queue"
2. **Check if output channel opens** with queue status
3. **Try queue control commands**:
   - "RUV-Swarm: Pause Command Queue"
   - "RUV-Swarm: Resume Command Queue"
   - "RUV-Swarm: Clear Command Queue"

## 🔍 Advanced Debug Testing

### Test 8: File Watcher Events
1. **Create a new .ts file** in Extension Development Host
2. **Save the file** (Ctrl+S)
3. **Check Debug Console** for file watcher events
4. **Modify and save again** to test debouncing

### Test 9: Configuration Changes
1. **Open Settings** in Extension Development Host
2. **Search for "ruv-swarm"**
3. **Change a setting** (e.g., maxAgents)
4. **Check Debug Console** for configuration change events

### Test 10: Keyboard Shortcuts
Test all keyboard shortcuts and monitor debug output:
- `Ctrl+Shift+A I` - Initialize Swarm
- `Ctrl+Shift+A C` - Spawn Coding Agent
- `Ctrl+Shift+A R` - Analyze Current File
- `Ctrl+Shift+A T` - Generate Tests
- `Ctrl+Shift+A V` - Code Review
- `Ctrl+Shift+A O` - Optimize Performance
- `Ctrl+Shift+A S` - Security Analysis
- `Ctrl+Shift+A E` - Explain Code
- `Ctrl+Shift+A F` - Refactor Code
- `Ctrl+Shift+A M` - Monitor Swarm
- `Ctrl+Shift+A B` - Benchmark Performance

## 📊 Expected Debug Output Patterns

### Successful Command Execution
```
🎯 DEBUG: User executed command: [commandName]
[Additional context like file paths, selections, etc.]
[Command-specific processing logs]
```

### Error Scenarios
```
📊 DEBUG: [Error context]
[Error details and stack traces]
[Recovery actions taken]
```

### Performance Monitoring
```
📊 DEBUG: [Performance metrics]
[Memory usage information]
[Timing data]
```

## ✅ Debug Verification Checklist

### Extension Activation
- [ ] Extension activates without errors
- [ ] All managers initialize in correct order
- [ ] CLI validation completes (may show warning if CLI not installed)
- [ ] File watcher starts successfully
- [ ] Commands register without errors
- [ ] Providers register successfully
- [ ] Configuration loads correctly

### User Interaction Tracking
- [ ] Command executions are logged with timestamps
- [ ] File context is captured for relevant commands
- [ ] Text selections are tracked for code analysis commands
- [ ] User choices in dialogs are logged
- [ ] Keyboard shortcuts trigger debug output
- [ ] Context menu interactions are tracked

### Error Handling
- [ ] Errors are caught and logged appropriately
- [ ] Extension continues functioning after errors
- [ ] Error reports are accessible via command
- [ ] Stack traces are available for debugging

### Performance Monitoring
- [ ] Command queue status is accessible
- [ ] Memory usage can be monitored
- [ ] File watcher events are debounced correctly
- [ ] Configuration changes are handled smoothly

## 🐛 Troubleshooting

### If Extension Doesn't Activate
1. Check Debug Console for activation errors
2. Verify npm dependencies: `npm install`
3. Recompile: `npm run compile`
4. Check TypeScript compilation errors

### If Commands Don't Appear
1. Verify package.json contributions
2. Check command registration in Debug Console
3. Ensure Extension Development Host has extension enabled

### If Debug Output Missing
1. Ensure Debug Console is open and visible
2. Check console.log statements in source code
3. Verify source maps are working
4. Restart debug session if needed

## 📈 Performance Testing

### Memory Usage Testing
1. Open large workspace in Extension Development Host
2. Execute multiple commands rapidly
3. Monitor memory usage in Chrome DevTools
4. Check for memory leaks over time

### Command Queue Testing
1. Execute multiple commands simultaneously
2. Monitor queue status via "Show Command Queue"
3. Test pause/resume functionality
4. Verify error handling in queue processing

### File Watcher Testing
1. Create/modify multiple files rapidly
2. Check debouncing behavior in Debug Console
3. Test with large files and many file changes
4. Verify performance with excluded patterns

---

**Complete this testing script to validate your debugging setup! 🎯**
