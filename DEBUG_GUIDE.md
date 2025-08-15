# RUV-Swarm Extension Debugging Guide

This guide provides comprehensive instructions for debugging the RUV-Swarm VSCode extension and monitoring user interactions.

## 🚀 Quick Start

### 1. Launch Extension in Debug Mode

1. **Open the project** in VSCode
2. **Press F5** or go to Run → Start Debugging
3. **Select "Run Extension (Debug Mode)"** from the dropdown
4. A new VSCode window will open titled **"[Extension Development Host]"**

### 2. Monitor Debug Output

1. **In the main VSCode window**: View → Debug Console
2. **Watch for debug messages** with these prefixes:
   - `📊 DEBUG:` - System initialization and configuration
   - `🎯 DEBUG:` - User command interactions
   - `🧠` - Extension lifecycle events

## 🔧 Debug Configurations

### Available Launch Configurations

1. **Run Extension (Debug Mode)** - Recommended for development
   - Disables other extensions for cleaner debugging
   - Enables source maps and smart stepping
   - Shows async stack traces
   - Auto-recompiles on file changes

2. **Run Extension (Production Mode)** - Test production behavior
   - Runs with all extensions enabled
   - Compiles once before launch

3. **Extension Tests** - Run unit tests
   - Executes test suite in extension host

4. **Attach to Extension Host** - Advanced debugging
   - Attach to running extension process

## 📊 Debug Logging Categories

### System Initialization (`📊 DEBUG:`)
- Extension activation sequence
- Manager initialization order
- Configuration loading
- CLI validation results
- File watcher setup

### User Interactions (`🎯 DEBUG:`)
- Command executions with timestamps
- Active file context
- Text selections
- User choices in dialogs

### Example Debug Output
```
🧠 RUV-Swarm extension is now active!
📊 DEBUG: Extension activation started at: 2025-01-15T16:44:03.123Z
📊 DEBUG: VSCode version: 1.74.0
📊 DEBUG: Initializing ErrorHandler...
📊 DEBUG: Initializing SwarmManager...
🎯 DEBUG: User executed command: analyzeCurrentFile
🎯 DEBUG: Active editor file: /path/to/file.ts
```

## 🧪 Testing User Interactions

### 1. Command Palette Testing
```bash
# Open Command Palette: Cmd+Shift+P (Mac) / Ctrl+Shift+P (Windows/Linux)
# Search for: "RUV-Swarm"
# Execute any command and watch debug console
```

### 2. Keyboard Shortcut Testing
```bash
# Test key bindings:
Ctrl+Shift+A I  # Initialize Swarm
Ctrl+Shift+A C  # Spawn Coding Agent
Ctrl+Shift+A R  # Analyze Current File
Ctrl+Shift+A T  # Generate Tests
```

### 3. Context Menu Testing
```bash
# Right-click in editor → Look for RUV-Swarm options
# Right-click in file explorer → Test file-specific commands
```

### 4. Activity Bar Testing
```bash
# Look for brain icon (🧠) in activity bar
# Click to open RUV-Swarm panel
# Test panel interactions
```

## 🔍 Advanced Debugging Techniques

### 1. Breakpoint Debugging
```typescript
// Set breakpoints in key locations:
// - src/extension.ts:activate() function
// - Command handlers in registerCommands()
// - Manager initialization methods
```

### 2. Console Debugging
```typescript
// Add custom debug points:
console.log('🔍 CUSTOM DEBUG:', variableName, additionalContext);
```

### 3. Error Monitoring
```bash
# Use built-in error reporting:
# Command Palette → "RUV-Swarm: Show Error Reports"
```

### 4. Performance Monitoring
```bash
# Monitor command queue:
# Command Palette → "RUV-Swarm: Show Command Queue"
```

## 📋 Debug Checklist

### Extension Activation
- [ ] Extension activates without errors
- [ ] All managers initialize successfully
- [ ] CLI validation completes
- [ ] File watcher starts
- [ ] Status bar shows ready state
- [ ] Activity bar icon appears

### Command Execution
- [ ] Commands appear in Command Palette
- [ ] Keyboard shortcuts work
- [ ] Context menus show RUV-Swarm options
- [ ] Commands execute without errors
- [ ] Debug output shows user interactions

### UI Components
- [ ] Activity bar panel loads
- [ ] Dashboard webview opens
- [ ] Status bar updates correctly
- [ ] Notifications appear as expected

### Error Handling
- [ ] Errors are caught and logged
- [ ] Error reports are accessible
- [ ] Extension continues working after errors

## 🛠️ Troubleshooting

### Common Issues

1. **Extension doesn't activate**
   ```bash
   # Check debug console for activation errors
   # Verify all dependencies are installed: npm install
   # Recompile: npm run compile
   ```

2. **Commands not appearing**
   ```bash
   # Check if extension is enabled in Extension Development Host
   # Verify package.json command contributions
   # Look for registration errors in debug console
   ```

3. **Debug output not showing**
   ```bash
   # Ensure Debug Console is open (View → Debug Console)
   # Check if console.log statements are present
   # Verify source maps are working
   ```

4. **Breakpoints not hitting**
   ```bash
   # Ensure source maps are enabled in launch.json
   # Check that TypeScript compiled successfully
   # Verify file paths in outFiles configuration
   ```

## 📈 Performance Monitoring

### Memory Usage
```bash
# Monitor extension memory usage:
# 1. Open Chrome DevTools for Extension Host
# 2. Go to Memory tab
# 3. Take heap snapshots during operation
```

### Command Queue Analysis
```bash
# Monitor command execution:
# Command Palette → "RUV-Swarm: Show Command Queue"
# Watch for bottlenecks or failed commands
```

### File Watcher Performance
```bash
# Monitor file system events:
# Check debug output for file change notifications
# Verify debouncing is working correctly
```

## 🔄 Development Workflow

### 1. Make Changes
```bash
# Edit source files
# TypeScript will auto-compile (watch mode)
# Extension will reload automatically
```

### 2. Test Changes
```bash
# Execute commands in Extension Development Host
# Monitor debug console for new behavior
# Test error scenarios
```

### 3. Debug Issues
```bash
# Set breakpoints as needed
# Add console.log statements
# Use step-through debugging
```

### 4. Validate Performance
```bash
# Check command execution times
# Monitor memory usage
# Test with large workspaces
```

## 📝 Debug Log Analysis

### Key Patterns to Watch For

1. **Initialization Sequence**
   - All managers should initialize in order
   - No errors during startup
   - Configuration loads correctly

2. **User Interaction Flow**
   - Commands execute immediately
   - Context information is captured
   - No hanging operations

3. **Error Recovery**
   - Errors are handled gracefully
   - Extension continues functioning
   - Error reports are generated

## 🎯 Next Steps

After setting up debugging:

1. **Test Core Functionality** - Execute each command and verify behavior
2. **Test Error Scenarios** - Try invalid operations and check error handling
3. **Performance Testing** - Test with large files and workspaces
4. **User Experience Testing** - Verify UI responsiveness and feedback

## 📞 Support

If you encounter issues:

1. Check the debug console output
2. Review error reports via "Show Error Reports" command
3. Check the command queue status
4. Verify extension configuration

---

**Happy Debugging! 🐛🔍**
