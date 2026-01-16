# Arc Browser Troubleshooting

## Issue: Keyboard Shortcuts Not Working in Arc

### Current Status
- **Cmd+Shift+H** (Generate Reply) - NOT WORKING in Arc
- **Cmd+Shift+G** (Improve Text) - NOT WORKING in Arc
- Extension loaded and visible in Arc
- Buttons appear in Gmail (extension content script works)

### Quick Checks

#### 1. Check Keyboard Shortcut Registration
```
arc://extensions/shortcuts
```

- [ ] Verify "Gmail AI Reply Assistant" appears in the list
- [ ] Check if Cmd+Shift+H and Cmd+Shift+G are registered
- [ ] Look for conflicts with other extensions or Arc shortcuts

#### 2. Check Extension Permissions
```
arc://extensions/
```

- [ ] Find "Gmail AI Reply Assistant"
- [ ] Verify "Permissions" shows:
  - ✅ Read and change your data on mail.google.com
  - ✅ Manage your apps, extensions, and themes
- [ ] Check for any permission warnings

#### 3. Check Console Logs

**Background Service Worker:**
```
arc://extensions/ → Click "service worker" link
```

Expected when shortcut pressed:
```
Command received: generate_reply
Sending trigger message to active tab ID: [number]
```

If you DON'T see these logs, the shortcut isn't reaching the extension.

**Content Script (on Gmail):**
```
Open Gmail → F12 → Console
```

Look for:
```
Content script loaded v0.7.7
```

### Known Arc Browser Differences

Arc Browser is Chromium-based but has differences:

1. **Command Bar Integration**
   - Arc's Command Bar (Cmd+T) may intercept shortcuts
   - Check Arc Settings → Shortcuts for conflicts

2. **Extension Sandbox**
   - Arc may sandbox extensions differently
   - Some Chrome APIs might behave differently

3. **Keyboard Shortcut Priority**
   - Arc native shortcuts take precedence
   - Cmd+Shift+H might conflict with Arc features

### Workarounds

#### Option 1: Try Different Shortcuts
Edit `src/manifest.json`:

```json
"commands": {
  "generate_reply": {
    "suggested_key": {
      "default": "Ctrl+Shift+J",
      "mac": "Command+Shift+J"
    },
    "description": "Open AI Reply Assistant"
  },
  "improve_text": {
    "suggested_key": {
      "default": "Ctrl+Shift+K",
      "mac": "Command+Shift+K"
    },
    "description": "Improve selected text with AI"
  }
}
```

Then reload extension.

#### Option 2: Use Extension Buttons
The AI Reply and Improve Text buttons should still work in Gmail compose window.

#### Option 3: Add Context Menu (TODO)
Right-click context menu could provide alternative access:
- Right-click in compose → "Generate AI Reply"
- Right-click on selected text → "Improve with AI"

### Testing Different Shortcuts

Try these alternatives if Cmd+Shift+H doesn't work:

| Shortcut | Likely Conflicts |
|----------|------------------|
| Cmd+Shift+H | Arc History? |
| Cmd+Shift+J | Usually safe |
| Cmd+Shift+K | Developer tools in some browsers |
| Cmd+Shift+L | Usually safe |
| Cmd+Option+H | Less common |
| Cmd+Option+G | Less common |

### Debug Steps

1. **Verify Extension Loaded:**
   ```bash
   # Check extension loads without errors
   arc://extensions/ → Check for error messages
   ```

2. **Test in Regular Chrome:**
   - Load extension in Chrome (not Arc)
   - Test if shortcuts work there
   - If yes → Arc-specific issue
   - If no → Extension configuration issue

3. **Check Arc Version:**
   ```
   Arc → About Arc
   ```
   - Arc version: ?
   - Chromium version: ?

4. **Try Incognito/Private:**
   - Open Arc in private mode
   - Test if shortcuts work there
   - May bypass some Arc customizations

### Temporary Solution

Until keyboard shortcuts work in Arc, you can:

1. **Use the buttons:**
   - Look for the AI Reply button in Gmail compose toolbar
   - Click it instead of using Cmd+Shift+H

2. **Switch to Chrome for this extension:**
   - Install extension in Chrome
   - Use Chrome specifically for Gmail with AI assist
   - Use Arc for other browsing

### Next Steps for Fix

**TODO:** Investigate Arc-specific implementation:

1. **Check Arc Extension API:**
   - Does Arc support chrome.commands API fully?
   - Any Arc-specific documentation needed?

2. **Add Context Menu Fallback:**
   ```javascript
   chrome.contextMenus.create({
     title: "Generate AI Reply",
     contexts: ["editable"],
     onclick: openModal
   });
   ```

3. **Add Arc Detection:**
   ```javascript
   const isArc = navigator.userAgent.includes('Arc');
   if (isArc) {
     // Use alternative approach
   }
   ```

4. **Contact Arc Support:**
   - Report keyboard shortcut issue
   - Ask about extension compatibility

### Report Issue

If shortcuts don't work after trying above:

1. Note Arc version
2. Note which shortcuts don't work
3. Check if ANY extension shortcuts work in Arc
4. File issue: https://github.com/anthropics/claude-code/issues

---

## Current Status: INVESTIGATING

The keyboard shortcut issue in Arc is tracked as **Bug #1 (CRITICAL)** in TODO.md.

**Workaround:** Use the AI Reply and Improve Text buttons in Gmail compose toolbar.
