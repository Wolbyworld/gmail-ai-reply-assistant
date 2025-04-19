# Gmail AI Reply Assistant – End‑to‑End Build Blueprint & Test‑Driven LLM Prompts
*Version 0.1 – 19 Apr 2025*

---
## 0 · Reading Guide
1. **Blueprint** → phased roadmap with iterative chunks.
2. **Micro‑steps** → smallest safe increments (each ≤ 1–2 hr dev effort) with test scaffolds.
3. **LLM Prompts** → one prompt per micro‑step (tagged as `text`) ready for a code‑gen LLM that follows TDD.

Copy this file into your preferred prompt‑runner. Pass each prompt to the LLM sequentially; every prompt assumes the repo state at the end of the previous step.

---
## 1 · Phased Roadmap
| Phase | Business Goal | Iteration # | Outcome |
|-------|---------------|-------------|---------|
| 0 | Tooling & skeleton | 0 – 1 | Reliable scaffold, CI, lint & Jest |
| 1 | Gmail DOM hook | 2 | Icon appears in every compose window |
| 2 | Modal UI | 3 | Accessible Shadow‑DOM modal |
| 3 | User guidance capture | 4 | Selection → textarea pre‑fill |
| 4 | Settings storage | 5 | Options page, secure API key |
| 5 | Background messaging | 6 | Robust content ↔ background channel |
| 6 | OpenAI integration | 7 | Draft appended with spinner UX |
| 7 | Resilience & a11y | 8 | Error banners, focus‑trap, ESC |
| 8 | Test matrix | 9 | Unit + Playwright green |
| 9 | Release | 10 | Zip bundle + GitHub Actions CI |

---
## 2 · Iterations & Micro‑Steps
Below is the *final grain* after two rounds of decomposition. Each step is "right‑sized": testable, orthogonal, yet forward‑moving.

### Iteration 0 – Project Scaffold
| Step | Description |
|------|-------------|
| **0.1** | Init `npm`, add ESLint+Prettier, husky pre‑commit, basic Jest config. |
| **0.2** | Create minimal MV3 `manifest.json` + empty `src/` tree; write a Jest snapshot test that validates manifest schema. |

### Iteration 1 – Gmail Compose Detection
| Step | Description |
|------|-------------|
| **1.1** | Implement `utils/gmail.js#getComposeWindows()` returning live NodeList; unit‑test with JSDOM. |
| **1.2** | Inject temporary pigeon icon button in each compose toolbar via `content.js`; ensure idempotence. Playwright test opens Gmail mock page. |

### Iteration 2 – Modal Skeleton
| Step | Description |
|------|-------------|
| **2.1** | Build `ui/modal.html` & `ui/modal.css`; no JS yet. Snapshot test HTML. |
| **2.2** | In `content.js` create Shadow DOM, render modal template, open/close via icon. Unit test DOM open/close. |

### Iteration 3 – Talking‑Points Capture
| Step | Description |
|------|-------------|
| **3.1** | Prefill textarea with current selection (if any). Jest test selection injection. |
| **3.2** | Close modal on **ESC** & outside click; ensure focus‑trap (tab cycling). |

### Iteration 4 – Persistent Settings
| Step | Description |
|------|-------------|
| **4.1** | Write `utils/storage.js` wrapper with `getSettings`/`setSettings`; mock `chrome.storage` tests. |
| **4.2** | Build options page (HTML+JS) for API key, model dropdown, template textarea; validate input. Playwright form test. |

### Iteration 5 – Background Messaging
| Step | Description |
|------|-------------|
| **5.1** | Implement `background.js` message router: listen for `generate` → echo dummy draft. Jest message port test. |
| **5.2** | Wire `content.js` to send message and show inline spinner; remove spinner on response. |

### Iteration 6 – OpenAI Fetch & Draft Append
| Step | Description |
|------|-------------|
| **6.1** | Replace dummy with real OpenAI fetch (mocked in Jest); enforce 1000 token limit & streaming disabled. |
| **6.2** | Append reply below existing body, place cursor; Playwright verifies DOM mutation. |

### Iteration 7 – Error Handling & A11y Polish
| Step | Description |
|------|-------------|
| **7.1** | Error banner component with close button; triggered on simulated 4xx/5xx. |
| **7.2** | Audit & fix accessibility roles/labels; add unit tests using `axe-core`. |

### Iteration 8 – Comprehensive Test Matrix
| Step | Description |
|------|-------------|
| **8.1** | Expand Jest coverage for utils; enforce ≥ 90 % threshold. |
| **8.2** | Add Playwright scenarios: multi‑compose, dark‑mode, invalid key. |

### Iteration 9 – Build & CI
| Step | Description |
|------|-------------|
| **9.1** | Rollup build script → `dist/ai‑reply.zip`; smoke test manifest paths. |
| **9.2** | GitHub Actions: lint, test, build artifact on push to `main`. |

---
## 3 · LLM Prompts (Deliver to Code‑Gen Model)
> **Usage:** Feed each prompt *in order*. Review the diff + tests after each run before proceeding.

### Prompt 0.1 – Initialise Project Scaffold
```text
# Context
You are starting a new Chrome‑extension repository named **ai‑reply** (Manifest V3). The repo is currently empty.

# Objectives
1. Run `npm init -y` and add dev‑dependencies:
   - eslint, prettier, eslint-config-prettier
   - jest, @jest/globals, jsdom
   - husky, lint-staged
2. Create configuration files:
   - `.eslintrc.json` extending **eslint:recommended**, enabling ES2022, browser & jest envs.
   - `.prettierrc` with singleQuote = true, printWidth = 100.
3. Add a `test` script (`"jest"`) and a `lint` script (`"eslint \"src/**/*.js\""`).
4. Add a pre‑commit hook via husky that runs `lint-staged` (lint & test staged files).
5. Commit all files; ensure `npm test` passes (should be zero tests for now).

# Deliverables
- package.json with the above scripts and dependencies
- ESLint & Prettier configs
- Husky pre‑commit hook setup committed in `.husky/`

Write code, configs, and any setup scripts needed. Do **not** add extension source code yet.
```

### Prompt 0.2 – Minimal Manifest & Schema Test
```text
# Context
Repo contains tooling from Step 0.1. There is no `src/` directory yet.

# Tasks
1. Inside **src/** create a minimal `manifest.json` targeting MV3 with:
   - name: "Gmail AI Reply Assistant"
   - version: "0.0.1"
   - manifest_version: 3
   - description: "Draft Gmail replies with GPT."
   - permissions: ["storage", "activeTab", "scripting"]
   - host_permissions: ["https://mail.google.com/*"]
2. Add Jest dev‑dependency `jest-validate` and write a snapshot test `manifest.test.js` that:
   - imports the JSON
   - validates required top‑level fields exist
   - checks `manifest_version === 3`
3. Update `npm test` to run with `--runInBand` (JSDOM not required yet).

# Acceptance Criteria
- `npm test` passes with one green test suite.
- Lint passes.
```

### Prompt 1.1 – Implement getComposeWindows()
```text
# Context
Extension scaffolding is in place with a valid manifest. We need Gmail‑specific helpers under **src/utils/**.

# Specifications
1. Create `src/utils/gmail.js` exporting:
   ```js
   /**
    * Returns a live NodeList of Gmail compose window root elements.
    * Implementation should rely on Gmail’s class `editable` within an element
    * that has the `aria-label="Message Body"`.
    */
   export function getComposeWindows() { /* … */ }
   ```
2. Add Jest test `gmail.test.js` using JSDOM to stub a simplified Gmail DOM and assert:
   - returns correct count when one or multiple compose windows exist
   - live list updates when new element appended

# Constraints
- No side effects; function only queries DOM.
- 100 % branch coverage for this module.
```

### Prompt 1.2 – Inject Pigeon Icon
```text
# Context
With helper ready, we can inject UI.

# Tasks
1. Add `src/content.js` that:
   - On `document_idle`, queries compose windows via `getComposeWindows()`.
   - For each compose window’s toolbar, inserts a `<button id="ai‑reply‑btn" aria‑label="AI Reply" />` containing a pigeon emoji (🕊️) **once** per window.
   - Uses MutationObserver to watch for new compose windows and perform the same injection.
2. Add CSS rule inlined via JS (for now) giving the button `background:none;border:none;cursor:pointer`.
3. E2E test (Playwright): load a static Gmail‑mock HTML where compose windows are dynamically added; assert the button is present in each instance.

# Acceptance
- No duplicate buttons when observer fires multiple times.
- Lint, Jest, Playwright all green.
```

### Prompt 2.1 – Modal Mark‑Up & Style
```text
# Context
We need a modal template with standalone styling.

# Tasks
1. Under **src/ui/** add `modal.html` containing:
   - div.overlay (full‑screen, semi‑transparent)
   - div.modal > h2, textarea#ai‑tp, div.actions > button.submit, button.cancel
2. Add `modal.css` with minimal dark/light neutral palette, rounded corners, and a CSS spinner class for later.
3. Snapshot Jest test ensuring the HTML structure matches spec.

# Note
No JavaScript logic yet.
```

### Prompt 2.2 – Shadow DOM Modal Logic
```text
# Context
We will render modal via Shadow DOM to avoid Gmail CSS bleed.

# Tasks
1. Extend `content.js`:
   - When pigeon button clicked, create (if not already) a `<div id="ai‑modal‑host">` appended to `document.body`.
   - Attach shadowRoot, clone `modal.html` template, inject `modal.css` as `<style>`.
   - Implement open/close functions; close on cancel.
2. Unit tests (JSDOM) verifying:
   - Modal opens and `document.activeElement` is textarea.
   - Close removes `ai‑modal‑host` from DOM.
```

### Prompt 3.1 – Prefill Talking‑Points
```text
# Context
Improve UX by seeding textarea with selected text.

# Tasks
1. On modal open, check if `window.getSelection().toString()` is non‑empty → set textarea value.
2. Add Jest test mocking selection API.
3. Ensure text is HTML‑decoded (no `<br>` or entities).
```

### Prompt 3.2 – ESC & Focus‑Trap
```text
# Context
Accessibility polish.

# Tasks
1. Listen for `keydown` on shadowRoot; if `key === "Escape"` close modal.
2. Implement basic focus‑trap: keep tabindex elements in modal cycling with Tab/Shift+Tab.
3. Axe‑core Jest test confirming no critical a11y issues.
```

### Prompt 4.1 – Storage Wrapper
```text
# Context
Persistent user settings.

# Tasks
1. Add `src/utils/storage.js` exporting async `getSettings()` & `setSettings(partial)`.
2. Use `chrome.storage.sync` under the key `ai‑reply.settings`.
3. Jest tests mocking `chrome.storage`.
```

### Prompt 4.2 – Options Page
```text
# Context
UI for API key, model & template.

# Tasks
1. Create `src/options/options.html`, `options.js`, and `options.css`.
2. Form fields: password input (API key), select (model), textarea (template), reset button (restore default).
3. On submit, call `setSettings`; on load, hydrate via `getSettings`.
4. Playwright test fills form and asserts persistence.
```

### Prompt 5.1 – Background Message Router
```text
# Context
Need a service worker responding to generate requests.

# Tasks
1. Implement `src/background.js`:
   - `chrome.runtime.onMessage.addListener` listens for `{type:"generate"}`.
   - Immediately responds with `{draft:"(dummy draft)"}`.
2. Jest tests simulate message passing using `sinon-chrome`.
```

### Prompt 5.2 – Spinner & Message Send
```text
# Context
Front‑end feedback loop.

# Tasks
1. In `content.js` submit handler:
   - Close modal, add inline spinner right side of compose header.
   - Send `{type:"generate", bulletPoints, emailContext}` to background, using `await chrome.runtime.sendMessage`.
   - On response, remove spinner and call `appendDraft()` (to be implemented).
2. Unit test spinner add/remove logic with fake timers.
```

### Prompt 6.1 – Real OpenAI Fetch
```text
# Context
Wire to external API.

# Tasks
1. In `background.js`, replace dummy with a `fetch` to `https://api.openai.com/v1/chat/completions` using settings:
   - model, prompt template, bulletPoints, emailContext
   - `max_tokens:1000`, `temperature:0.7`
2. Use streaming **disabled** for simplicity.
3. Inject `Authorization: Bearer ${apiKey}`.
4. Jest test mocks fetch (nock) returning `{choices:[{message:{content:"Hi"}}]}` and asserts draft extracted.
```

### Prompt 6.2 – Append Draft & Cursor
```text
# Context
Display generated reply.

# Tasks
1. Implement `utils/gmail.js#appendDraft(composeEl, draftText)` that:
   - Inserts text below existing body, no blank line.
   - Sets cursor to end.
2. Playwright test verifies insertion in live Gmail DOM.
```

### Prompt 7.1 – Error Banner Component
```text
# Context
Graceful failure UX.

# Tasks
1. Add CSS & JS to create inline `<div class="ai‑error">message</div>` at top of compose window.
2. `background.js` on non‑2xx or fetch error sends `{type:"error", code, message}`; content displays banner.
3. Unit tests inject error and assert banner appears & dismisses.
```

### Prompt 7.2 – Accessibility Audit & Fixes
```text
# Context
Ship with solid a11y.

# Tasks
1. Run `axe-core` on modal and options page; fix violations.
2. Add Jest a11y tests to CI.
```

### Prompt 8.1 – Coverage Thresholds
```text
# Context
Hardening tests.

# Tasks
1. Configure Jest `coverageThreshold` global ≥ 90 lines/branches.
2. Add badges to README.
```

### Prompt 8.2 – Playwright Scenarios
```text
# Context
Cross‑browser regression.

# Tasks
1. Add tests: dark theme, multi‑compose, invalid key (401).
2. Ensure GH Actions runs Playwright in headed Chrome.
```

### Prompt 9.1 – Rollup Build Script
```text
# Context
Produce zip for Chrome Web Store.

# Tasks
1. Install Rollup + @rollup/plugin‑node‑resolve.
2. Rollup config bundles JS into `dist/` preserving file structure.
3. Copy static assets (`manifest.json`, html, css) via `rollup-plugin-copy`.
4. After build, run `zip -r dist/ai‑reply.zip dist/*`.
5. Jest smoke test ensures manifest paths exist in zip (use `adm‑zip`).
```

### Prompt 9.2 – GitHub Actions CI
```text
# Context
Automate quality gate.

# Tasks
1. `.github/workflows/ci.yml` steps:
   - `actions/checkout`
   - `setup-node@v4` install Node 20
   - `npm ci`
   - `npm run lint && npm test --coverage`
   - Run Playwright tests (headed mode)
   - `npm run build`
   - Upload `ai‑reply.zip` as artifact
2. Badge in README for CI status.
```

---
## 4 · Next Steps
1. Feed Prompt 0.1 to your code‑gen LLM and iterate.
2. After each step, **manually review** PR diff & test results.
3. Stop if any tests fail, adjust prompt or fix code.

Happy Building! 🚀

