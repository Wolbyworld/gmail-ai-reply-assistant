# Gmail AI Reply Assistant – Developer Specification

*Version: 1.0 – 19 Apr 2025*

---
## 1. Objective
Create a Chrome extension that embeds an **AI‑Reply** button (temporary pigeon icon) inside Gmail’s compose window. When clicked, it opens a lightweight modal where users enter/edit talking‑points; the extension then calls OpenAI (GPT‑4.1 or GPT‑4.5) to draft a reply using the full email thread as context and appends the generated text into the composer.

---
## 2. Functional Requirements
| # | Requirement |
|---|-------------|
| FR‑1 | Show pigeon icon next to existing composer extension icons (bottom toolbar, left of emoji/drive/etc.). |
| FR‑2 | Clicking the icon opens a **modal** (centered, single multiline `<textarea>` with placeholder: *“Enter bullet points or guidance for your reply…”*). |
| FR‑3 | If user has text highlighted when icon is clicked → pre‑fill textarea with that text (editable). |
| FR‑4 | Modal closes on **Submit**, **Esc**, or click‑outside. |
| FR‑5 | On **Submit**: close modal immediately, show inline spinner inside composer header, call OpenAI, then append draft directly below existing body (no blank line) and place cursor after it. |
| FR‑6 | Prompt template (default below) + model + API key pulled from Options page. |
| FR‑7 | Options page (right‑click > *Options*): secure input for API key, model dropdown (GPT‑4.1 / GPT‑4.5), editable prompt template with “Restore default”. |
| FR‑8 | Max tokens fixed at 1000. |
| FR‑9 | Error conditions show inline red banner inside modal or composer with actionable text. |

### Default Prompt Template
```text
Write a draft response to the emails below in the context. Keep it simple, respect my tone (normally informal) and the language of the email chain.

These are talking points
[Bullet_points]

Email context:
[Email_context]
```

---
## 3. Non‑Functional Requirements
* **Browser**: Chrome ≥ 115, Manifest V3.
* **Domains**: Runs only on `https://mail.google.com/*`.
* **Accounts**: Works for any Gmail (personal & Workspace) using same global settings.
* **Localization**: English UI strings, but generated draft respects email language via prompt.
* **Accessibility**: Modal focus‑traps, `aria‑label` on textarea, ESC closes.
* **Privacy**: No analytics. Email content sent only to OpenAI.

---
## 4. Architecture & File Structure
```
ai‑reply/
 ├─ manifest.json              # MV3 manifest
 ├─ background.js              # Service‑worker: stores token; performs OpenAI fetch
 ├─ content.js                 # Injected on compose; adds icon; handles UI & DOM ops
 ├─ ui/modal.html              # Shadow DOM template for modal
 ├─ ui/modal.css               # Minimal styling (no external libs)
 ├─ options/options.html       # Options page
 ├─ options/options.js         # Logic for settings CRUD
 ├─ utils/gmail.js             # Helper funcs (getEmailContext, appendDraft, etc.)
 └─ utils/storage.js           # Wrapper around chrome.storage.sync
```

### 4.1 Manifest (essential sections)
```json
{
  "manifest_version": 3,
  "name": "Gmail AI Reply Assistant",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["https://mail.google.com/*", "https://api.openai.com/*"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
      "matches": ["https://mail.google.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
  }],
  "options_page": "options/options.html",
  "icons": {"16": "icons/pigeon16.png", "32": "icons/pigeon32.png"}
}
```

### 4.2 Data Flow
1. **content.js** detects compose window mutations → injects botón.
2. User clicks icon → content.js shows modal.
3. On submit → content.js sends message `{type:"generate", bulletPoints, emailContext}` to **background.js**.
4. background.js reads `{apiKey, model, prompt}` from storage, formats final prompt, calls `https://api.openai.com/v1/chat/completions`.
5. Returns `{draft}` to content.js → which appends draft & removes spinner.
6. Errors propagate same channel for UI display.

#### Reasoning
*Keep OpenAI key out of page context by performing fetch in background script (avoids exposure via devtools).*

---
## 5. Data Handling & Security
| Data | Where Stored | Encryption | Retention |
|------|--------------|------------|-----------|
| OpenAI API Key | `chrome.storage.sync` | Chrome encrypts at‑rest | Until user deletes |
| Prompt template & model | `chrome.storage.sync` | N/A, non‑sensitive | Persistent |
| Email context / bullet points | Memory only, sent over TLS to OpenAI | N/A | Discarded after reply generation |

---
## 6. Error Handling Strategy
| Scenario | UX Behaviour | Dev Notes |
|-----------|-------------|-----------|
| Network / OpenAI error | Red inline banner: *“Couldn’t reach OpenAI. Check your internet or API key.”* | Retry not automatic. |
| 401 / invalid key | Banner: *“OpenAI rejected the request. Verify your API key in Options.”* | |
| 429 / quota | Banner: *“Quota exceeded. View usage at platform.openai.com.”* | |
| Unexpected DOM change (Gmail update) | Console warning + toast: *“Failed to inject AI‑Reply button. Gmail layout may have changed.”* | Gracefully fail; avoid crashes. |

---
## 7. Testing Plan
### 7.1 Unit Tests  (Jest)
* utils/gmail.js: `getEmailContext()`, `appendDraft()` stub DOM.
* utils/storage.js: read/write mock chrome.storage.

### 7.2 Integration Tests  (Playwright)
| Test ID | Steps | Expected |
|---------|-------|----------|
| IT‑1 | Open Gmail → compose → click AI button (no selection) | Modal appears with empty textarea |
| IT‑2 | Type bullets, submit | Modal closes, spinner shows, draft appended |
| IT‑3 | Highlight some body text → click icon | Modal shows pre‑filled text |
| IT‑4 | Error inject (invalid key) | Inline error banner |
| IT‑5 | Esc key closes modal without side‑effects |
| IT‑6 | Multiple compose windows | Button appears in each; independent modals |

### 7.3 Manual QA Matrix
* Browsers: Chrome stable, Beta.
* OS: Windows, macOS, Linux.
* Gmail themes: default light & dark.
* Accounts: personal gmail.com, Workspace.

### 7.4 Lint & Build
* ESLint + Prettier CI check.
* `npm run build` → zip ready for Chrome Web Store.

---
## 8. Development Notes
* Use Shadow DOM for modal to prevent Gmail CSS bleed.
* Avoid external UI libs – keep bundle <50 kB.
* Spinner can be minimal CSS animation inline right of formatting toolbar.

---
## 9. Future Enhancements (out‑of‑scope)
* Support more models / temperature slider.
* Auto‑translate reply to detected language.
* Context size trimming / thread summarization.
* Per‑account configuration.

---
### END OF SPEC

