# Specification: Improve Any Selected Text in Chrome

## 1. Overview

*   Extend the "Improve Selected Text" feature beyond Gmail.
*   Allow users to select text on *any* webpage within Chrome and use the same LLM functionality to improve it in place (where possible).
*   Triggered by the same keyboard shortcut (`Cmd+Shift+G` or equivalent).
*   Ensure no conflict with the Gmail-specific implementation.

## 2. Requirements

*   **Trigger:** Keyboard shortcut (`Cmd+Shift+G` or user-configurable equivalent).
*   **Context:** Detect selected text on the current webpage.
*   **Action:**
    *   If no text is selected, briefly change the extension's browser action icon (e.g., add a temporary badge or overlay) to indicate the command was received but no action could be taken.
    *   If text is selected:
        *   Extract the selected text.
        *   Provide loading feedback: Show a subtle spinner near the selection *and* temporarily change the browser action icon.
        *   Send the text to the background script for processing via the LLM, using the existing "Improve Text System Prompt" but *without* email context.
        *   Attempt to replace the selected text with the LLM's response directly on the page (only in editable fields).
        *   If direct replacement fails (e.g., non-editable area or error during replacement): Show a small, temporary overlay positioned near the original selection. The overlay should contain the improved text and a "Copy" button, and dismiss on click-away or after a timeout.
        *   On LLM API errors or network issues: Indicate the error via the browser action icon (e.g., a persistent error badge until dismissed).
        *   Ensure the trigger differentiates between being inside a Gmail composer and elsewhere.

## 3. Implementation Plan

*   **`manifest.json`:**
    *   Ensure content script permissions cover `<all_urls>` to run on any page.
    *   Add `action` permission to allow modification of the browser action icon (for loading/error/no-selection feedback).
    *   Consider `storage` permission if icon state needs to persist slightly (e.g., error badge).
*   **`src/options/`:**
    *   No changes strictly required. The existing `improvePromptTemplate` will be reused. The prompt itself is designed to handle missing context gracefully.
*   **`src/background.js`:**
    *   Modify the `IMPROVE_TEXT` message handler:
        *   Expect an optional `source` field (e.g., `'gmail'` or `'generic'`).
        *   Modify `createImprovePrompt` (or adapt its usage) to *only* include email context if `source` is `'gmail'`. For `'generic'`, only use the selected text and the base prompt template.
        *   The API call logic remains the same.
        *   Send the result back via `IMPROVE_TEXT_RESULT` as before.
*   **`src/content.js`:**
    *   **Activation/Context Detection:**
        *   The script already runs due to manifest changes.
        *   The `Cmd+Shift+G` listener needs refinement:
            *   Check if the current selection/focus is within a known Gmail composer element (reuse existing detection logic).
            *   If Gmail composer: Extract email context (if available) and send `IMPROVE_TEXT` message with `selectedText`, `context`, and `source: 'gmail'`.
            *   If *not* Gmail composer: Get selected text. If empty, trigger no-selection feedback (via message to background script or direct API call if possible). If text exists, trigger loading feedback (spinner + message background for icon change), send `IMPROVE_TEXT` message with `selectedText` and `source: 'generic'` (no `context`).
    *   **Text Replacement (`handleImproveTextResult`):**
        *   This handler receives the improved text and potentially an error status.
        *   Clear loading feedback (spinner + message background for icon reset).
        *   If error: Trigger error feedback on icon (via message to background).
        *   If success:
            *   Implement a new function, e.g., `replaceOrShowOverlay(originalSelection, newText)`.
            *   Inside `replaceOrShowOverlay`:
                *   Check if the original selection's element is editable (`<textarea>`, `<input>`, `[contenteditable="true"]`).
                *   If editable: Try `document.execCommand('insertText', false, newText)`. Test undo (`Cmd+Z`). If `execCommand` fails, proceed to overlay fallback.
                *   If *not* editable or `execCommand` failed: Create and display the overlay near `originalSelection`'s bounding box. Include `newText`, a copy button, and dismissal logic (click-away, maybe timeout).
            *   Modify `handleImproveTextResult` to call the appropriate replacement logic based on source (Gmail vs generic) and success/error status. Handle potential errors during replacement itself.
    *   **UI Feedback:**
        *   Implement functions to show/hide a subtle spinner element near a given DOM Rect/selection.
        *   Implement logic to create, position, and manage the overlay (content, copy button, dismissal).
        *   Send messages to the background script to request changes to the browser action icon state (loading, error, no-selection, idle).

## 4. Considerations

*   **Robust Text Replacement:** Replacing text reliably across diverse websites is challenging. Prioritize editable fields and provide a good fallback (like copy-to-clipboard).
*   **Performance:** Ensure selection detection and context checking are efficient.
*   **Security:** Be mindful of interacting with arbitrary webpage content.
*   **User Experience:** Make the generic feature non-intrusive. The chosen feedback mechanisms (subtle spinner, icon changes, temporary overlay for non-editable areas) aim for this. Ensure the overlay doesn't badly clash with website layouts and is easily dismissable. Clear feedback on error states via the icon is crucial.
*   **Configuration:** Consider if users might eventually want separate prompts for Gmail vs. generic text improvement. (Keep simple for now).
*   **Icon Management:** The background script will need to manage the state of the browser action icon to handle overlapping requests or quick state changes (e.g., loading -> error).

## V2: Split System Prompts (Based on Discussion)

### Overview

Modify the "Improve Text" feature to use separate system prompts based on whether the feature is triggered within Gmail or on a generic webpage. Both prompts will be configurable via the extension's options page.

### Requirements

*   **Separate Prompts:** Maintain the existing configurable prompt for Gmail context (`improvePromptTemplate`) and introduce a new configurable prompt for generic web context (`genericImprovePromptTemplate`).
*   **Configuration:** Add UI elements in the options page to display and edit the new `genericImprovePromptTemplate`.
*   **Contextual Selection:** The background script must choose the correct prompt based on the `source` field (`'gmail'` or `'generic'`) received from the content script.
*   **Backward Compatibility:** Ensure existing users have a functional generic prompt by providing a default value if `genericImprovePromptTemplate` is not yet set in storage.

### Default Generic Prompt

The following prompt will be used as the default for `genericImprovePromptTemplate` if not configured by the user:

```text
Act as a proofreading expert. Carefully review the following text for spelling mistakes, typos, and minor grammatical errors. Correct any issues you find, but do not change the style or meaning of the original message. Return only the corrected version

[Selected_text]
```

*(Note: Ensure the placeholder `[Selected_text]` is included in the final default prompt stored).* 

### Implementation Plan V2

*   **`src/utils/storage.js`:**
    *   Add new key `genericImprovePromptTemplate`.
    *   Update `getSettings` to retrieve both prompts, providing the default generic prompt if the new key is missing.
    *   Ensure `saveSettings` logic handles saving the new key.
*   **`src/options/options.html` & `options.js`:**
    *   Add a new labeled textarea for `genericImprovePromptTemplate`.
    *   Update loading logic to populate both textareas.
    *   Update saving logic to read and save both prompt values.
*   **`src/background.js`:**
    *   Modify `handleMessage` for `IMPROVE_TEXT`:
        *   Retrieve both `improvePromptTemplate` and `genericImprovePromptTemplate` from settings.
        *   Select the appropriate template based on `message.source`.
        *   Pass the selected template string to `createImprovePrompt`.
    *   No changes needed within `createImprovePrompt` itself.
*   **`src/content.js`:**
    *   No changes needed.
