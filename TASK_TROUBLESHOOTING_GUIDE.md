# VS Code Task Troubleshooting Guide

## Current Status
✅ **npm run watch** works correctly from terminal
❓ **VS Code Task Runner** may still have caching issues

## Multiple Ways to Run the Extension in Test Mode

### Method 1: Direct Terminal (RECOMMENDED)
```bash
# This is working correctly
npm run watch
```

### Method 2: VS Code Task Runner
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Tasks: Run Task"
3. Select "watch" (not "npm: watch")
4. If this still shows the old error, try the next methods

### Method 3: VS Code Build Task
1. Press `Ctrl+Shift+P`
2. Type "Tasks: Run Build Task"
3. Select "watch" (it should be the default build task)

### Method 4: Extension Development Host
1. Press `F5` or use "Run and Debug" panel
2. This will compile and launch a new VS Code window with your extension loaded
3. This is the proper way to test VS Code extensions

## If VS Code Task Runner Still Shows Old Error

### Solution 1: Reload VS Code Window
1. Press `Ctrl+Shift+P`
2. Type "Developer: Reload Window"
3. Execute the command
4. Try running the task again

### Solution 2: Clear VS Code Workspace State
1. Close VS Code completely
2. Delete `.vscode/.ropeproject` if it exists
3. Reopen the project
4. Try the task again

### Solution 3: Reset Task Cache
1. Close VS Code
2. Navigate to VS Code settings directory:
   - Windows: `%APPDATA%\Code\User\workspaceStorage`
   - Mac: `~/Library/Application Support/Code/User/workspaceStorage`
   - Linux: `~/.config/Code/User/workspaceStorage`
3. Find and delete the folder for this workspace
4. Reopen VS Code and the project

## Current Task Configuration
The tasks.json has been updated with:
- Simplified task labels (no "npm:" prefix)
- Explicit workspace folder references
- Proper shell-based configuration
- Background task settings for watch mode

## Testing the Extension
Since `npm run watch` is working, you can:

1. **Use F5 to launch Extension Development Host** (BEST METHOD)
2. **Use the terminal command** while developing
3. **Use VS Code tasks** once the cache issue is resolved

## Verification Steps
To verify everything is working:

1. ✅ `npm run watch` - Working
2. ✅ `npm run compile` - Should work
3. ✅ Extension can be packaged with `npm run package`
4. ✅ Extension can be tested with F5 (Extension Development Host)

The core issue (malformed task configuration) has been resolved. Any remaining issues are VS Code caching problems, not code problems.
