# TODO - Bug Fixes and Improvements

This document tracks known bugs and issues in the Gmail AI Reply Assistant extension.

## Critical Bugs

### 1. Keyboard Shortcuts Not Working in Arc Browser
**File:** `src/manifest.json`, `src/background.js`
**Severity:** CRITICAL
**Issue:** Cmd+Shift+H and Cmd+Shift+G keyboard shortcuts don't trigger in Arc browser. Shortcuts are defined in manifest.json and handler exists in background.js, but Arc may handle keyboard shortcuts differently than Chrome.
**Impact:** Primary feature (keyboard shortcuts) completely broken for Arc users.
**Fix:**
- Check Arc browser keyboard shortcut registration (may need different approach)
- Consider alternative: Arc Command Bar integration
- Check chrome://extensions/shortcuts in Arc to see if shortcuts are registered
- May need Arc-specific manifest permissions or API calls
- Alternative: Add right-click context menu as fallback

### 2. Gmail Compose Window Detection Failing in Tests
**File:** `src/utils/gmail.js:53`, `src/__tests__/gmail.test.js`
**Severity:** CRITICAL
**Issue:** The `isLikelyComposeWindow()` filter is too strict - requires `rect.width > 100 && rect.height > 50`, but JSDOM doesn't calculate dimensions properly. Tests show 0 windows detected when 1-2 should be found.
**Impact:** 12 failing tests in gmail.test.js
**Fix:** Adjust dimension requirements or add fallback detection logic for test environments.

### 2. DOM Reference Becomes Invalid After Modal Closure
**File:** `src/content.js:560-574`
**Severity:** HIGH
**Issue:** Code stores `currentComposeWindow` reference, then closes modal and removes DOM elements. Later operations (like `showBanner()`) use this potentially stale reference.
**Impact:** Banners may fail to display; operations on detached DOM nodes.
**Fix:** Ensure DOM operations complete before modal closure, or re-query compose window after close.

### 3. API Response Structure Not Validated
**File:** `src/background.js:124-128`
**Severity:** HIGH
**Issue:** No validation of OpenAI response structure before accessing `data.choices[0].message.content`. If structure is unexpected, extension crashes.
**Impact:** Complete failure on malformed API responses.
**Fix:** Add comprehensive response validation with fallback handling.

## High Priority Bugs

### 4. Keyboard Shortcuts Unreliable - Race Condition in Icon Updates
**File:** `src/background.js:379`
**Severity:** HIGH
**Issue:** `updateActionIcon()` is async but not awaited in keyboard command listener. Can cause icon state to be incorrect or race with other operations.
**Impact:** Extension icon shows wrong state; shortcuts may appear unresponsive.
**Fix:** Await all `updateActionIcon()` calls consistently.

### 5. Unhandled Promise Rejection in Text Improvement
**File:** `src/content.js:1456-1465`
**Severity:** HIGH
**Issue:** `triggerImproveText()` has two separate `chrome.runtime.sendMessage()` calls with callback handlers but no proper Promise-based error handling. Icon state errors don't prevent main message from being sent.
**Impact:** Silent failures; user sees loading state but gets no result or error.
**Fix:** Convert to Promise-based async/await with proper try/catch.

### 6. Multiple Pending Promises in Modal Submit
**File:** `src/content.js:494-614`
**Severity:** HIGH
**Issue:** Multiple `chrome.runtime.sendMessage()` calls without proper cancellation logic. If user closes modal while awaiting, `currentComposeWindow` reference becomes stale.
**Impact:** Errors when trying to append draft; orphaned API requests.
**Fix:** Add AbortController or cancellation tokens for pending operations.

### 7. Null Compose Window Not Handled
**File:** `src/content.js:821-1116` (multiple functions)
**Severity:** HIGH
**Issue:** Functions like `extractEmailContext()`, `createAIReplyButton()`, and `findPreferredInjectionPoint()` assume compose window is always valid but don't handle edge case where it becomes detached from DOM.
**Impact:** Null pointer errors when compose window is removed.
**Fix:** Add null checks and graceful degradation throughout.

## Medium Priority Bugs

### 8. No Timeout on Chrome Message Passing
**File:** `src/content.js:508, 536, 1457, 1501-1523`
**Severity:** MEDIUM
**Issue:** All `chrome.runtime.sendMessage()` calls lack timeouts. If background script is unresponsive, requests hang indefinitely.
**Impact:** Extension appears frozen; no user feedback.
**Fix:** Implement Promise.race() with timeout for all message passing.

### 9. API Key Not Validated Before Modal Opens
**File:** `src/content.js:672-673`
**Severity:** MEDIUM
**Issue:** TODO comment indicates validation is incomplete. Modal opens even if API key is missing; error only occurs during generation.
**Impact:** Poor UX - user enters talking points before learning API key is missing.
**Fix:** Validate settings (especially API key) before opening modal.

### 10. Shadow DOM Event Listener Cleanup Leak
**File:** `src/content.js:392-785`
**Severity:** MEDIUM
**Issue:** Keydown listener is removed from shadowRoot, but overlay and textarea click listeners (lines 755-785) are never explicitly cleaned up before modal removal.
**Impact:** Memory leaks with repeated modal open/close cycles.
**Fix:** Track all event listeners and remove them in cleanup function.

### 11. Banner Container Positioning Before Parent Setup
**File:** `src/content.js:245-255`
**Severity:** MEDIUM
**Issue:** Banner container uses `position: absolute` with `bottom: 40px`, but compose window doesn't have `position: relative` set until after first banner is created.
**Impact:** First banner placement is unpredictable.
**Fix:** Set parent position before creating banner container.

### 12. Selection Loss During Async Operations
**File:** `src/content.js:1416-1436`
**Severity:** MEDIUM
**Issue:** If user loses selection while async operations are pending, stored `lastSelectionRange` becomes invalid.
**Impact:** Text improvement fails or replaces wrong content.
**Fix:** Re-validate selection before replacement; show error if selection lost.

### 13. Multiple Modals Can Open with Rapid Clicks
**File:** `src/content.js:654-659`
**Severity:** MEDIUM
**Issue:** Existing modal check uses only ID, but rapid keyboard shortcut presses can bypass the synchronous check before first modal's DOM is fully created.
**Impact:** Multiple overlapping modals; confusing UX.
**Fix:** Use async lock/semaphore pattern to prevent concurrent modal opens.

### 14. Incomplete OpenAI Error Handling
**File:** `src/background.js:103-135`
**Severity:** MEDIUM
**Issue:** Retry logic only handles reasoning parameter errors and temperature errors, not all 400 errors. Other validation failures don't retry gracefully.
**Impact:** Transient API errors cause complete failure.
**Fix:** Implement comprehensive error categorization and retry logic.

### 15. Silent Failures in Resource Fetching
**File:** `src/content.js:362-373`
**Severity:** MEDIUM
**Issue:** `fetchText()` returns empty string on network failures without proper error indication. If modal.html or modal.css fail to load, modal creation continues with empty content.
**Impact:** Broken modal UI with no error message.
**Fix:** Throw errors instead of returning empty strings; handle at call site.

### 16. Settings Not Validated on Load or Save
**File:** `src/options/options.js:32-51, 57-103`
**Severity:** MEDIUM
**Issue:** `loadSettings()` and save logic don't validate values. Invalid model names, empty selections, or corrupted settings won't be caught.
**Impact:** Runtime errors when invalid settings are used.
**Fix:** Add schema validation for all settings fields.

### 17. Overly Permissive Host Permissions
**File:** `src/manifest.json:15-26`
**Severity:** MEDIUM
**Issue:** Content script runs on `<all_urls>` with no specific targeting. Unnecessary injection on non-Gmail pages.
**Impact:** Performance overhead; security concerns; potential conflicts.
**Fix:** Limit to `*://mail.google.com/*` and related Gmail domains.

### 18. No Error Recovery for Missing Web Resources
**File:** `src/manifest.json:29-40`
**Severity:** MEDIUM
**Issue:** If any web accessible resource is missing (modal.html, modal.css, icons), entire modal fails.
**Impact:** Complete feature failure on corrupted installations.
**Fix:** Add error boundaries and fallback UI for missing resources.

### 19. Spinner Not Removed on Quick Modal Close
**File:** `src/content.js:466-489`
**Severity:** MEDIUM
**Issue:** If modal is closed while spinner is active, cleanup may fail because `shadowRoot` becomes null.
**Impact:** Orphaned spinner elements; UI artifacts.
**Fix:** Check shadowRoot validity before all operations; store references defensively.

### 20. Memory Leak in Overlay Click Handler
**File:** `src/content.js:1751-1760`
**Severity:** MEDIUM
**Issue:** Click handler added with `capture: true` but may not be properly removed if overlay is destroyed abnormally.
**Impact:** Memory leaks with repeated operations.
**Fix:** Use WeakMap to track handlers; ensure cleanup in all code paths.

## Low Priority Issues

### 21. Reasoning Effort Parameter Not Validated
**File:** `src/background.js:82-92`
**Severity:** LOW
**Issue:** `reasoningEffort` parameter passed directly without validation. Invalid values (e.g., 'extreme') will be rejected by API.
**Impact:** Confusing API errors for invalid settings.
**Fix:** Validate against allowed values: 'minimal', 'low', 'medium', 'high'.

### 22. Silent Settings Storage Failures
**File:** `src/utils/storage.js:36-47`
**Severity:** LOW
**Issue:** Settings retrieval errors silently return defaults. Can't distinguish between "no settings saved" and "storage error".
**Impact:** Difficult to debug storage issues.
**Fix:** Add telemetry or user-visible warnings for storage failures.

### 23. Inconsistent Banner Visibility Control
**File:** `src/content.js:627-635`
**Severity:** LOW
**Issue:** Banner uses both `display` property and `data-visible` attribute for visibility control.
**Impact:** Code maintenance confusion; potential bugs.
**Fix:** Standardize on single visibility control method.

### 24. Inconsistent Error Handling Patterns
**File:** Multiple files
**Severity:** LOW
**Issue:** Some functions use try/catch, others use .catch(), some don't handle errors at all.
**Impact:** Code maintainability; unpredictable error behavior.
**Fix:** Establish and enforce consistent error handling patterns.

### 25. TODO Comments Left Unimplemented
**File:** `src/content.js:672`
**Severity:** LOW
**Issue:** TODO comment for API key validation remains unimplemented:
```javascript
// TODO: Potentially validate settings here (e.g., check for API key)
```
**Impact:** Feature incompleteness.
**Fix:** Implement or remove TODO comments.

## Enhancements

### 26. Add Message Passing Timeout Utility
**Suggested Location:** `src/utils/messaging.js` (new file)
**Description:** Create a wrapper function for `chrome.runtime.sendMessage()` that includes configurable timeout, retry logic, and proper error handling.
**Benefit:** Consistent, reliable message passing throughout extension.

### 27. Add Settings Schema Validation
**Suggested Location:** `src/utils/validation.js` (new file)
**Description:** Create JSON schema validator for settings to catch invalid configurations early.
**Benefit:** Prevent runtime errors from bad settings.

### 28. Improve Gmail Selector Resilience
**File:** `src/utils/gmail.js`
**Description:** Add more fallback selectors and heuristics for compose window detection. Consider using MutationObserver patterns more extensively.
**Benefit:** More reliable detection across Gmail UI changes.

### 29. Reduce API Latency / Improve Performance
**File:** `src/background.js`, `src/content.js`
**Severity:** HIGH
**Issue:** Current implementation has noticeable latency when generating replies or improving text. User experience suffers from slow response times.
**Impact:** Poor UX, users perceive extension as slow.
**Improvements needed:**
- Add streaming response support from OpenAI API (show text as it's generated)
- Implement request caching for similar prompts
- Optimize prompt templates to reduce token count
- Add loading progress indicators with estimated time
- Consider parallel API calls for multiple operations
- Preload/warm up connections to OpenAI API
- Show partial results while waiting for full response
- Add option for faster models (gpt-4o-mini vs gpt-4o)
**Priority:** High - directly impacts user satisfaction

### 30. Improve System Prompts and Templates
**File:** `src/utils/storage.js`, `src/options/options.html`
**Severity:** MEDIUM
**Issue:** Current default prompt templates are basic and could produce better results with optimization.
**Impact:** Lower quality AI-generated content than possible.
**Improvements needed:**
- Better compose prompt template with context-aware instructions
- Improved text improvement prompts with style preservation
- Add examples/few-shot learning to prompts
- Include tone/style options (professional, casual, friendly)
- Better email context extraction and formatting
- Add prompt versioning and A/B testing capability
- Consider prompt engineering best practices from OpenAI docs
- Add pre-built prompt templates for common use cases:
  - Professional business email
  - Friendly casual reply
  - Brief acknowledgment
  - Detailed explanation
  - Polite decline
**Priority:** Medium - improves output quality

## Testing Improvements

### 31. Fix Failing Gmail Tests
**File:** `src/__tests__/gmail.test.js`
**Description:** Update tests to work with JSDOM limitations or add integration tests with real DOM.
**Current Status:** 12/12 tests failing.

### 32. Add Integration Tests for Message Passing
**Description:** Test the full flow: keyboard shortcut → content script → background → API → response → DOM update.
**Benefit:** Catch race conditions and async issues that unit tests miss.

### 33. Add Visual Regression Tests for Modal UI
**Description:** Ensure modal, banners, and buttons render correctly across Gmail UI changes.
**Benefit:** Catch UI breakage before users see it.

---

## Priority Legend
- **CRITICAL**: Blocks core functionality; immediate fix required
- **HIGH**: Significantly impacts UX or reliability; fix soon
- **MEDIUM**: Noticeable issues; fix when possible
- **LOW**: Minor issues; fix if convenient

## Next Steps
1. **URGENT:** Fix Arc browser keyboard shortcuts (item 1) - blocking primary feature
2. Address performance/latency issues (item 29) - impacts UX
3. Fix critical bugs (items 2-3)
4. Improve system prompts (item 30) - better output quality
5. Fix failing tests (item 31)
6. Address remaining medium priority bugs (items 8-25)

## Recently Fixed (v0.7.7)
- ✅ Bug #4: Keyboard shortcuts unreliable - Race condition fixed
- ✅ Bug #5: Unhandled promise rejection in triggerImproveText
- ✅ Bug #6: Multiple pending promises in handleSubmit
- ✅ Bug #2: DOM reference becomes invalid after modal closure
- ✅ Bug #7: Null compose window not handled
- ✅ Bug #9: API key not validated before modal opens
- ✅ Bug #17: Overly permissive host permissions
