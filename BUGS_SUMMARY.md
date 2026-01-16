# Bugs & Improvements Summary

## 🔴 Critical Bugs (2)

### 1. Keyboard Shortcuts Not Working in Arc Browser
- **Impact:** Primary feature completely broken for Arc users
- **Status:** NEW - just discovered
- **Workaround:** Use the AI Reply and Improve Text buttons in Gmail
- **See:** ARC_TROUBLESHOOTING.md for debug steps

### 2. Gmail Compose Window Detection Failing in Tests
- **Impact:** 12/12 tests failing in gmail.test.js
- **Issue:** isLikelyComposeWindow() too strict for JSDOM
- **Priority:** Fix test infrastructure

---

## 🟠 High Priority Bugs (1 remaining + 5 fixed)

### 3. API Response Structure Not Validated
- **Impact:** Extension crashes on malformed API responses
- **Fix:** Add comprehensive response validation
- **File:** src/background.js:124-128

### ✅ FIXED in v0.7.7:
- ~~Bug #4: Keyboard shortcuts race condition~~
- ~~Bug #5: Unhandled promise rejections~~
- ~~Bug #6: Multiple pending promises~~
- ~~Bug #2: DOM references invalid~~
- ~~Bug #7: Null compose window~~

---

## 🟡 Medium Priority Bugs (13)

### 8. No Timeout on Chrome Message Passing
- **Impact:** Extension appears frozen if background unresponsive
- **Fix:** Implement Promise.race() with timeout

### 10. Shadow DOM Event Listener Cleanup Leak
- **Impact:** Memory leaks with repeated modal open/close
- **Fix:** Track and remove all event listeners

### 11. Banner Container Positioning Before Parent Setup
- **Impact:** First banner placement unpredictable
- **Fix:** Set parent position before creating banner

### 12. Selection Loss During Async Operations
- **Impact:** Text improvement fails or replaces wrong content
- **Fix:** Re-validate selection before replacement

### 13. Multiple Modals Can Open with Rapid Clicks
- **Impact:** Multiple overlapping modals
- **Fix:** Add async lock/semaphore pattern

### 14. Incomplete OpenAI Error Handling
- **Impact:** Some 400 errors don't retry gracefully
- **Fix:** Comprehensive error categorization

### 15. Silent Failures in Resource Fetching
- **Impact:** Broken modal UI with no error
- **Fix:** Throw errors instead of returning empty strings

### 16. Settings Not Validated on Load or Save
- **Impact:** Runtime errors from invalid settings
- **Fix:** Add schema validation

### 18. No Error Recovery for Missing Web Resources
- **Impact:** Complete failure on corrupted installations
- **Fix:** Add error boundaries and fallback UI

### 19. Spinner Not Removed on Quick Modal Close
- **Impact:** Orphaned spinner elements
- **Fix:** Check shadowRoot validity defensively

### 20. Memory Leak in Overlay Click Handler
- **Impact:** Memory leaks with repeated operations
- **Fix:** Use WeakMap to track handlers

### ✅ FIXED in v0.7.7:
- ~~Bug #9: API key not validated before modal~~
- ~~Bug #17: Overly permissive host permissions~~

---

## 🔵 Low Priority Bugs (5)

### 21. Reasoning Effort Parameter Not Validated
- Invalid values rejected by API with confusing errors

### 22. Silent Settings Storage Failures
- Can't distinguish "no settings" from "storage error"

### 23. Inconsistent Banner Visibility Control
- Uses both display property and data-visible attribute

### 24. Inconsistent Error Handling Patterns
- Mix of try/catch, .catch(), and no handling

### 25. TODO Comments Left Unimplemented
- Unfinished code markers need implementation

---

## 🚀 Enhancements (8)

### 26. Add Message Passing Timeout Utility
- Create wrapper for chrome.runtime.sendMessage() with timeout/retry
- **Benefit:** Consistent, reliable message passing

### 27. Add Settings Schema Validation
- JSON schema validator for settings
- **Benefit:** Prevent runtime errors from bad settings

### 28. Improve Gmail Selector Resilience
- More fallback selectors for compose window detection
- **Benefit:** More reliable across Gmail UI changes

### 29. Reduce API Latency / Improve Performance ⭐
- **Severity:** HIGH
- **User Impact:** Poor UX, slow response times
- **Improvements:**
  - Add streaming response support
  - Implement request caching
  - Optimize prompt templates
  - Add loading progress indicators
  - Parallel API calls
  - Preload/warm up connections
  - Show partial results while waiting
  - Faster model options (gpt-4o-mini)

### 30. Improve System Prompts and Templates ⭐
- **Severity:** MEDIUM
- **User Impact:** Lower quality AI-generated content
- **Improvements:**
  - Better context-aware instructions
  - Few-shot learning examples
  - Tone/style options (professional, casual, friendly)
  - Better email context extraction
  - Pre-built templates:
    - Professional business email
    - Friendly casual reply
    - Brief acknowledgment
    - Detailed explanation
    - Polite decline

---

## 🧪 Testing Improvements (3)

### 31. Fix Failing Gmail Tests
- 12/12 tests failing in gmail.test.js
- Update tests for JSDOM limitations or add integration tests

### 32. Add Integration Tests for Message Passing
- Test full flow: keyboard → content → background → API → DOM
- Catch race conditions and async issues

### 33. Add Visual Regression Tests for Modal UI
- Ensure modal, banners, buttons render correctly
- Catch UI breakage before users see it

---

## 📊 Summary by Priority

| Priority | Open | Fixed (v0.7.7) | Total |
|----------|------|----------------|-------|
| CRITICAL | 2 | 0 | 2 |
| HIGH | 1 | 5 | 6 |
| MEDIUM | 11 | 2 | 13 |
| LOW | 5 | 0 | 5 |
| **Bugs Total** | **19** | **7** | **26** |
| Enhancements | 8 | - | 8 |
| Testing | 3 | - | 3 |
| **Grand Total** | **30** | **7** | **37** |

---

## 🎯 Recommended Next Steps

### Immediate (This Session)
1. **Arc Keyboard Shortcuts** - Debug and fix (Bug #1)
2. Test if buttons work as workaround

### High Priority (Next Session)
1. **Performance/Latency** - Streaming responses (#29)
2. **API Response Validation** - Prevent crashes (#3)
3. **System Prompts** - Better output quality (#30)

### Medium Priority (Future)
1. Message passing timeouts (#8)
2. Memory leak fixes (#10, #20)
3. Settings validation (#16)
4. Error handling improvements (#14, #15, #18)

### Low Priority (When Time Permits)
1. Fix test failures (#31)
2. Clean up code quality issues (#21-25)
3. Add integration tests (#32-33)

---

## ✅ What We Accomplished (v0.7.7)

Fixed **7 critical/high bugs** in one session:
- ✅ Keyboard shortcuts race condition (Bug #4)
- ✅ Unhandled promise rejections (Bug #5)
- ✅ Multiple pending promises (Bug #6)
- ✅ DOM references invalid (Bug #2)
- ✅ Null compose window (Bug #7)
- ✅ API key validation (Bug #9)
- ✅ Host permissions restricted (Bug #17)

**Result:** More stable, secure, better error handling - but Arc shortcuts still broken!

---

See **TODO.md** for detailed descriptions of each bug and enhancement.
