# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Worktree Workflow

**IMPORTANT:** When working in a git worktree (check with `git worktree list`):
- After committing changes to a worktree branch, **always ask the user** if they want to create a PR and merge it to main
- Don't leave worktrees with uncommitted or unmerged changes - they get forgotten
- To merge a worktree: commit → push → `gh pr create` → `gh pr merge` → pull to main → clean up worktree

## Project Overview

Gmail AI Reply Assistant - A Chrome extension (Manifest V3) that uses OpenAI's GPT models to help users draft and improve email replies in Gmail. Features keyboard shortcuts (Cmd+Shift+H for reply generation, Cmd+Shift+G for text improvement), configurable AI models (GPT-5, GPT-5-mini, GPT-5-nano, GPT-4.1), and per-feature reasoning effort controls.

## Development Commands

### Quick Reference
```bash
./reload.sh           # Reload reminder (opens test pages)
npm test              # Run all tests with Jest (uses ESM modules)
npm run lint          # Run ESLint on src/**/*.js
./build.sh            # Production build with ZIP file
```

### Deployment Commands
```bash
# Build and deploy everything
./build.sh                                                    # Build extension ZIP
gh release create vX.X.X --title "vX.X.X" --notes "..."      # Create GitHub release
gh release upload vX.X.X gmail-ai-reply-assistant.zip         # Upload ZIP to release
npx wrangler pages deploy website --project-name=gmail-ai-assistant  # Deploy website
```

See **SETUP.md** for detailed development workflow.

### Development Workflow (Direct Source Editing)

**No build process!** Files you edit in `src/` ARE the files Chrome runs.

1. **One-time setup:**
   - Load extension: chrome://extensions/ → "Load unpacked" → Select `src/` folder
   - Configure: Extension icon → Options → Add API key

2. **Daily workflow:**
   ```bash
   # Edit files
   vim src/background.js

   # Reload reminder
   ./reload.sh

   # Manual reload in Chrome
   # chrome://extensions/ → Click ↻ on extension

   # Test in Gmail
   open "https://mail.google.com"
   ```

3. **Debug:**
   - Background logs: chrome://extensions/ → "service worker"
   - Content logs: Gmail page → F12 → Console

### Important Notes
- NO BUILD STEP - Edit `src/` files directly
- Version in 3 places (keep in sync): `manifest.json`, `background.js`, `content.js`
- Manual reload required in chrome://extensions/ after changes
- Tests run automatically on pre-commit via Husky + lint-staged
- Service worker console: Click "service worker" link in `chrome://extensions/`
- Content script console: DevTools (F12) on Gmail page

## Architecture

### Manifest V3 Service Worker Pattern

**Background Service Worker (`src/background.js`)**
- Handles all OpenAI API calls via `callOpenAI()`
- Message handler listens for commands from content scripts
- Icon state management (idle, loading, error, inactive)
- Prompt template processing with `createPrompt()` and `createImprovePrompt()`
- Settings retrieval from Chrome sync storage

**Content Script (`src/content.js`)**
- DOM manipulation for Gmail interface
- Detects compose windows using multiple Gmail selectors (see `src/utils/gmail.js`)
- Injects "Generate Reply" and "Improve Text" buttons
- Modal dialog management for talking points
- Keyboard shortcut handling (registered in manifest, handled in content script)
- Banner notifications for success/error feedback
- Email context extraction from Gmail DOM
- Text selection and replacement

**Storage (`src/utils/storage.js`)**
- Abstracts Chrome sync storage
- Manages defaults for API keys, model selections, reasoning effort levels, and prompt templates
- Settings: `composeModel`, `gmailImproveModel`, `generalImproveModel`, `composeReasoningEffort`, `improveReasoningEffort`, `generalImproveEffort`

### Key Data Flow

```
User Keyboard Shortcut → Content Script → Message to Background →
OpenAI API Call → Response → Content Script → DOM Injection
```

Settings: `Options Page → Chrome Sync Storage → Background/Content Scripts`

### Gmail DOM Integration

The extension must work with Gmail's dynamic, frequently-changing DOM structure. Key challenges:

- **Compose window detection**: Uses multiple selectors with fallbacks (see `getComposeWindows()` in `src/content.js`)
- **Mutation observer**: Watches for new compose windows appearing dynamically
- **Button injection**: Injects UI buttons into compose areas with specific positioning
- **Text insertion**: Uses `appendDraft()` to insert AI-generated text into compose windows

**Critical files for Gmail integration:**
- `src/utils/gmail.js` - Gmail-specific selectors and utilities
- `src/content.js:getComposeWindows()` - Multi-strategy compose window detection
- `src/content.js:setupMutationObserver()` - Watches for DOM changes

### OpenAI API Integration

**Model Support:**
- GPT-5, GPT-5-mini, GPT-5-nano, GPT-4.1
- Per-feature model selection (compose vs. improve)

**Reasoning Effort Parameter:**
- Levels: `minimal`, `low`, `medium`, `high`
- Controlled per-feature in settings
- Graceful fallback for models that don't support reasoning

**API Details:**
- Uses `max_completion_tokens: 1000` (not `temperature`)
- Endpoint: OpenAI Chat Completions API
- Error handling with icon state updates

## Testing

**Test Structure:**
- `src/__tests__/background.test.js` - Background service worker tests
- `src/__tests__/content.test.js` - Content script tests
- `src/__tests__/manifest.test.js` - Manifest validation
- `src/__tests__/gmail.test.js` - Gmail utility tests
- `src/__tests__/banner.test.js` - Banner notification tests

**Jest Configuration:**
- Uses `--experimental-vm-modules` for ESM support
- JSDOM for DOM testing
- Runs serially with `--runInBand`
- Pre-commit hook runs related tests automatically

## Code Structure

```
src/                           # Chrome extension source (load this in Chrome)
├── background.js              # Service worker (OpenAI API integration)
├── content.js                 # Gmail DOM manipulation, UI injection
├── manifest.json              # Extension manifest (VERSION SOURCE OF TRUTH)
├── options/                   # Settings page (API key, models, reasoning effort)
│   ├── options.html
│   ├── options.js
│   └── options.css
├── ui/                        # Modal interface for talking points
│   ├── modal.html
│   └── modal.css
└── utils/
    ├── storage.js             # Chrome sync storage abstraction
    └── gmail.js               # Gmail DOM selectors and helpers

website/                       # Landing page (deployed to Cloudflare Pages)
├── index.html                 # Landing page with download & install guide
└── favicon.svg                # Extension favicon

dist/                          # Build output (created by ./build.sh)
└── gmail-ai-reply-assistant.zip  # Distributable extension ZIP
```

## Important Patterns

### Adding New Settings
1. Add default in `src/utils/storage.js:DEFAULT_SETTINGS`
2. Update options page UI in `src/options/options.html`
3. Update save/load logic in `src/options/options.js`
4. Use settings in background/content scripts via `getSettings()`

### Modifying Gmail DOM Interaction
- Test with both reply and new compose scenarios
- Verify compose window detection with `getComposeWindows()`
- Check mutation observer still catches dynamic windows
- Test on both desktop and tablet-sized Gmail views

### API Changes
- Update `callOpenAI()` in `src/background.js`
- Handle backward compatibility for existing settings
- Update model options in `src/options/options.html`
- Test error handling with invalid API keys

## Version Management

- Version is defined in `src/manifest.json` only
- Update version there before releases
- Build process copies manifest to `dist/manifest.json`
- Current version: 0.9.5

## Deployment

### Live URLs

| Component | URL |
|-----------|-----|
| **Landing Page** | https://gmail-ai-assistant.pages.dev |
| **Extension ZIP Download** | https://github.com/Wolbyworld/gmail-ai-reply-assistant/releases/latest/download/gmail-ai-reply-assistant.zip |
| **GitHub Releases** | https://github.com/Wolbyworld/gmail-ai-reply-assistant/releases |

### Hosting Architecture

- **Website**: Cloudflare Pages (free tier)
  - Project name: `gmail-ai-assistant`
  - Source folder: `website/`
  - Auto-deployed via `wrangler pages deploy`

- **Extension ZIP**: GitHub Releases (free)
  - Stable download URL via `/releases/latest/download/`
  - Users download ZIP, extract, and load `src/` folder in Chrome

### Full Deployment Workflow

When releasing a new version:

```bash
# 1. Update version in src/manifest.json
# 2. Build the extension ZIP
./build.sh

# 3. Create GitHub release and upload ZIP
gh release create v0.9.X --title "v0.9.X" --notes "Release notes here"
gh release upload v0.9.X gmail-ai-reply-assistant.zip

# 4. Deploy website (if changed)
npx wrangler pages deploy website --project-name=gmail-ai-assistant

# 5. Verify
# - Visit https://gmail-ai-assistant.pages.dev
# - Test download link works
# - Test installation from downloaded ZIP
```

### Website Structure

```
website/
├── index.html      # Landing page with download button & installation guide
└── favicon.svg     # Extension favicon
```

The download button in `website/index.html` links directly to:
```
https://github.com/Wolbyworld/gmail-ai-reply-assistant/releases/latest/download/gmail-ai-reply-assistant.zip
```

### Cloudflare Pages Setup (One-time)

If project doesn't exist:
```bash
npx wrangler pages project create gmail-ai-assistant --production-branch main
```

### Cost

- Cloudflare Pages: **Free**
- GitHub Releases: **Free**
- Total: **$0/month**

## Documentation

- `/spec_docs/` - Detailed product and technical specifications
- `/README.md` - Installation and usage guide
- `/website/` - Landing page for distribution
- `.cursor/scratchpad.md` - Development history and tracking
