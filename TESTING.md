# Testing Guide - v0.7.7 Bug Fixes

## Quick Test Checklist

### 1. Extension Setup
- [ ] Load extension from `src/` folder in Chrome
- [ ] Verify version is 0.7.7 in chrome://extensions/
- [ ] Configure OpenAI API key in options
- [ ] Check background service worker console shows: `Background script starting initialization... v0.7.7`
- [ ] Open Gmail and check console shows: `Content script loaded v0.7.7`

### 2. Bug #4: Keyboard Shortcuts Reliability
**What was fixed:** Race condition in icon updates

Test steps:
- [ ] On Gmail: Press Cmd+Shift+H → Modal should open
- [ ] On Gmail: Press Cmd+Shift+G with text selected → Should improve text
- [ ] On non-Gmail page: Press Cmd+Shift+H → Icon should briefly show "inactive" state
- [ ] Check background console → No errors about icon state
- [ ] Verify icon changes: idle → loading → success/error → idle

**Expected:** All keyboard shortcuts work reliably, icon states update correctly

### 3. Bug #5: Text Improvement Error Handling
**What was fixed:** Unhandled promise rejections

Test steps:
- [ ] Select text in Gmail compose
- [ ] Press Cmd+Shift+G
- [ ] Verify spinner appears
- [ ] Watch background console → No unhandled promise rejections
- [ ] If API key missing: Should show error message (not silent failure)
- [ ] If API error occurs: Should remove spinner and show alert

**Expected:** All errors handled gracefully with user feedback

### 4. Bug #6 & #2: Modal Operation Ordering
**What was fixed:** Banner shown before modal closes

Test steps:
- [ ] Open Gmail, open an email
- [ ] Press Cmd+Shift+H to open modal
- [ ] Enter talking points, click Generate
- [ ] Watch carefully: Banner should appear BEFORE modal closes
- [ ] Verify: "AI Reply draft successfully added!" banner appears
- [ ] Verify: Draft inserted into compose window
- [ ] Modal should close AFTER banner appears

**Expected:** Banner always visible, modal closes smoothly after operations complete

### 5. Bug #7: Null Compose Window Handling
**What was fixed:** Added null and isConnected checks

Test steps:
- [ ] Open compose window in Gmail
- [ ] Verify AI Reply button appears
- [ ] Quickly close and reopen compose windows
- [ ] Check console → No "null" or "undefined" errors
- [ ] Try clicking buttons rapidly
- [ ] Verify no crashes when DOM changes

**Expected:** No null pointer errors, graceful handling of detached DOM nodes

### 6. Bug #9: API Key Validation
**What was fixed:** Validate API key before opening modal

Test steps:
- [ ] Remove API key from extension options (set to empty)
- [ ] Go to Gmail, open an email
- [ ] Press Cmd+Shift+H
- [ ] Verify: Error message appears IMMEDIATELY
- [ ] Verify: Modal does NOT open
- [ ] Error should say: "API Key is missing. Please set it in the extension options."
- [ ] Add API key back
- [ ] Press Cmd+Shift+H → Modal should open now

**Expected:** User sees error immediately if API key missing, doesn't waste time entering talking points

### 7. Bug #17: Host Permissions Restricted
**What was fixed:** Extension only runs on Gmail

Test steps:
- [ ] Go to Gmail → Extension icon active, buttons appear
- [ ] Go to google.com → Extension should NOT inject content
- [ ] Go to youtube.com → Extension should NOT inject content
- [ ] Go to any non-Gmail site → Extension should NOT run
- [ ] Check chrome://extensions/ → Verify permissions show only mail.google.com
- [ ] Press Cmd+Shift+H on non-Gmail → Should show "inactive" icon briefly

**Expected:** Extension ONLY active on mail.google.com

## Console Log Verification

### Background Service Worker Console
```
chrome://extensions/ → "service worker" link
```

Expected logs:
```
Background script starting initialization... v0.7.7
Setting up icon state management...
Icon state initialized.
[performSelfTest] Running self-test for background script...
Background service worker started.
```

When keyboard shortcut pressed:
```
Command received: generate_reply
Sending trigger message to active tab ID: [number]
TRIGGER_GENERATE message sent.
```

### Content Script Console
```
Gmail page → F12 → Console
```

Expected logs:
```
Content script loaded v0.7.7
Running Gmail-specific initialization...
[cleanupAllButtons] Starting cleanup...
[injectButtons] Injecting buttons into parent: [element]
```

When modal opened:
```
Attempting to open AI Reply Modal...
Settings retrieved successfully for modal open: {...}
Settings OK, opening modal...
```

## Error Cases to Test

### 1. API Key Errors
- [ ] Empty API key → Error before modal opens
- [ ] Invalid API key → Error during generation, spinner removed
- [ ] Network error → Error shown, icon set to error state

### 2. DOM Errors
- [ ] Close compose window while modal open → Should handle gracefully
- [ ] Remove compose window from DOM → Should not crash
- [ ] Rapid button clicks → Should not create multiple modals

### 3. Message Passing Errors
- [ ] Background script unresponsive → Should timeout and show error
- [ ] Invalid response format → Should show error message

## Performance Checks

- [ ] Extension loads without errors
- [ ] Buttons inject within 1 second of compose window appearing
- [ ] Modal opens instantly (< 100ms)
- [ ] API response time reasonable (depends on OpenAI)
- [ ] No memory leaks (check DevTools Performance tab)

## Regression Testing

Run automated tests:
```bash
npm test
```

Expected results:
- ✅ 22 tests passing (same as before)
- ❌ 34 tests failing (pre-existing gmail.test.js issues - Bug #1)
- Snapshot updated for manifest.json

## Manual Regression Tests

### Features That Should Still Work
- [ ] Generate reply from email context
- [ ] Improve text in Gmail compose
- [ ] Improve text on any page (if text selected)
- [ ] Settings page saves/loads correctly
- [ ] Multiple compose windows supported
- [ ] Banner notifications appear correctly

### Edge Cases
- [ ] Very long email context → Should truncate gracefully
- [ ] Empty talking points → Should still call API
- [ ] Special characters in text → Should encode/decode correctly
- [ ] Gmail UI changes → Should still find compose windows

## Known Issues (Not Fixed in 0.7.7)

From TODO.md:
- Bug #1: Compose window detection failing in tests (CRITICAL)
- Bug #8: No timeout on message passing (MEDIUM)
- Bug #10-16: Various medium/low priority issues

These are tracked in TODO.md for future fixes.

## Debugging Tips

### If keyboard shortcuts don't work:
1. Check chrome://extensions/shortcuts for conflicts
2. Verify extension loaded from correct path
3. Check background console for errors
4. Try reloading extension

### If buttons don't appear:
1. Check content console for errors
2. Verify Gmail selectors still match (Gmail UI changes)
3. Check if buttons already injected (marker present)
4. Try hard refresh (Cmd+Shift+R)

### If modal doesn't open:
1. Check for API key in options
2. Check content console for errors
3. Verify no other modal already open
4. Check shadowRoot creation

### If API calls fail:
1. Check API key validity
2. Check background console for detailed error
3. Verify network connectivity
4. Check OpenAI API status

## Success Criteria

All 7 bugs fixed:
- ✅ Bug #4: Keyboard shortcuts reliable
- ✅ Bug #5: Promise rejections handled
- ✅ Bug #6: Modal operations ordered correctly
- ✅ Bug #2: DOM references valid
- ✅ Bug #7: Null checks prevent crashes
- ✅ Bug #9: API key validated early
- ✅ Bug #17: Permissions restricted to Gmail

Extension should:
- Load without errors
- Inject buttons reliably
- Handle all keyboard shortcuts
- Show appropriate error messages
- Work only on Gmail (not other sites)
- Update icon states correctly
- Complete modal operations smoothly

## Ready to Deploy?

Before marking as ready:
- [ ] All manual tests pass
- [ ] No new test failures
- [ ] Console clean (no errors)
- [ ] Version bumped to 0.7.7
- [ ] CHANGELOG.md updated
- [ ] TODO.md updated with remaining issues

Then run `./build.sh` to create distribution ZIP.
