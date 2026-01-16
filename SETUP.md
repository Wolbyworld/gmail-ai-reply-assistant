# Development Setup - Direct Source Editing

**No build process. No auto-reload. Just edit files and reload extension manually.**

This is a pure Chrome extension - the files you edit ARE the files the browser runs.

---

## 🏗️ Architecture

```
src/
├── manifest.json       # Extension config (permissions, version)
├── background.js       # Service worker (OpenAI API calls)
├── content.js          # Gmail DOM manipulation
├── options/            # Settings page
├── utils/              # Storage and Gmail helpers
└── icons/              # Extension icons

ui/
├── modal.html          # Modal UI
└── modal.css           # Modal styles
```

**Key concept:** No bundling, no compilation. Direct source execution.

---

## 📍 One-Time Setup

### 1. Load Extension in Chrome

```bash
# 1. Open Chrome
# 2. Navigate to: chrome://extensions/
# 3. Enable "Developer mode" (top-right toggle)
# 4. Click "Load unpacked"
# 5. Select this directory:
#    /Users/alvaro/.claude-worktrees/gmail_extension_draft/ecstatic-mayer/src
```

**Important:** Load from `src/` directory directly, NOT from `dist/`!

### 2. Configure Extension

1. Click extension icon in Chrome toolbar
2. Select "Options"
3. Enter OpenAI API key
4. Save settings

### 3. Verify It Works

```bash
# Open Gmail
open "https://mail.google.com"

# Test keyboard shortcuts:
# - Cmd+Shift+H → Generate reply
# - Cmd+Shift+G → Improve text
```

---

## 🔄 Development Cycle

### The Workflow:

```bash
# 1. Edit files in src/
vim src/background.js

# 2. Run reload reminder
./reload.sh

# 3. Go to chrome://extensions/
# 4. Click ↻ reload icon on "Gmail AI Reply Assistant"

# 5. Test in Gmail
open "https://mail.google.com"
```

**That's it!** No build step. No watching. Just edit → reload → test.

---

## 🎯 Quick Commands

```bash
# Reload reminder
./reload.sh

# Open Gmail for testing
./reload.sh --test

# Open extensions page
./reload.sh --reload

# Run tests
npm test

# Lint code
npm run lint

# Create production ZIP
./build.sh
```

---

## 🐛 Debugging

### Background Script Logs
```
chrome://extensions/ → Find extension → Click "service worker" → Console
```

Look for: `Background script starting initialization... v0.7.6`

### Content Script Logs
```
Open Gmail → F12 → Console tab
```

Look for: `Content script loaded v0.7.6`

### Common Issues

**Problem:** Changes not appearing
**Solution:**
1. Check you edited files in `src/` (not `dist/`)
2. Reload extension in chrome://extensions/
3. Hard refresh Gmail (Cmd+Shift+R)

**Problem:** Extension not loaded from worktree
**Solution:**
```bash
# Check extension path in chrome://extensions/
# Should show: .../ecstatic-mayer/src
# NOT: .../gmail_extension_draft/src (main repo)
```

**Problem:** Keyboard shortcuts not working
**Solution:**
1. Reload extension
2. Refresh Gmail
3. Check chrome://extensions/shortcuts for conflicts

---

## 📝 Version Management

Version is in 3 places (keep in sync):
1. `src/manifest.json` → `"version": "0.7.6"`
2. `src/background.js` → `console.log('... v0.7.6')`
3. `src/content.js` → `console.log('... v0.7.6')`

Update all three when changing versions.

---

## 🔧 Git Worktree Workflow

This extension is in a git worktree:

**Worktree location:**
```
/Users/alvaro/.claude-worktrees/gmail_extension_draft/ecstatic-mayer
```

**Main repository:**
```
/Users/alvaro/Developer/gmail_extension_draft
```

**Current branch:** `ecstatic-mayer`

**Why worktrees?**
- Isolated development environment
- Main repo stays clean
- Can switch contexts without stashing
- Extension loads from specific worktree path

### Common Worktree Commands

```bash
# Create new worktree for feature
cd ~/Developer/gmail_extension_draft
git worktree add ~/.claude-worktrees/gmail_extension_draft/my-feature -b my-feature

# List worktrees
git worktree list

# Remove worktree when done
git worktree remove ~/.claude-worktrees/gmail_extension_draft/my-feature
```

---

## 🧪 Testing Strategy

### 1. Local Testing (Fast)
Just reload and test in Gmail - no special setup needed.

### 2. Automated Tests
```bash
npm test
```

Tests in `src/__tests__/`:
- `background.test.js` - API and message handling
- `content.test.js` - DOM manipulation
- `gmail.test.js` - Gmail selector utilities
- `banner.test.js` - Banner notifications
- `manifest.test.js` - Manifest validation

### 3. Real Gmail Testing
1. Reload extension
2. Open Gmail
3. Test keyboard shortcuts
4. Test on different email types (reply, compose, forward)
5. Check console for errors

---

## 🚀 Deployment

### Development ZIP
```bash
./build.sh
```

Creates:
- `dist/` folder
- `gmail-ai-reply-assistant.zip`

### What Gets Excluded
- `__tests__/` directories
- Test files
- Git files
- Documentation

---

## 📋 Key Differences from Build-Based Projects

| Aspect | Build-Based | This Extension |
|--------|-------------|----------------|
| Build | Webpack/Vite | None - direct source |
| Dependencies | npm install | Zero runtime deps |
| Reload | HMR | Manual browser reload |
| Debug | Single context | Multiple (background, content, popup) |
| Testing | Jest only | Jest + manual testing |
| Deploy | npm build | Zip source files |

---

## 🎯 Daily Workflow Example

```bash
# Morning: Start working
cd ~/.claude-worktrees/gmail_extension_draft/ecstatic-mayer

# Make changes
vim src/content.js

# Test changes
./reload.sh
# → Go to chrome://extensions/ → Click reload
# → Test in Gmail

# Run tests
npm test

# Commit
git add src/content.js
git commit -m "fix: keyboard shortcut reliability

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Continue iterating
```

---

## 📚 Documentation

- **SETUP.md** (this file) - Development workflow
- **TODO.md** - Bug list and priorities
- **CLAUDE.md** - Architecture and patterns
- **README.md** - Installation and usage

---

## ✅ Ready to Start

1. **Load extension:** chrome://extensions/ → Load unpacked → Select `src/`
2. **Configure:** Extension icon → Options → Add API key
3. **Edit files:** Edit files in `src/` directly
4. **Reload:** `./reload.sh` → chrome://extensions/ → Click reload
5. **Test:** Open Gmail → Try Cmd+Shift+H

**No build needed. No auto-reload. Just edit and reload!**
