# Specification: Improve Selected Text Feature

## 1. Overview

This feature allows users to select text within the Gmail composer (both replies and new emails) and use a language model to correct typos and improve the message directly in place. This is triggered separately from the original "Generate Reply" feature.

## 2. Requirements

### Generate Reply Feature (Existing)
- **Trigger**: 
    - Click the original AI Reply icon button (e.g., magic wand).
    - Use keyboard shortcut `Cmd+Shift+H`.
- **Action**: Opens a modal allowing the user to input bullet points. Extracts email context. Calls the LLM with the "Prompt Template" from settings to generate a draft reply, which is then appended to the compose window.

### Improve Selected Text Feature (New)
- **Trigger**: 
    - Click the new "Improve Text" icon button (e.g., pencil).
    - Use keyboard shortcut `Cmd+Shift+G`.
- **Context**: Detects selected text within the active Gmail composer.
- **Action**:
    - If no text is selected, show an informative message (e.g., banner) and stop.
    - If text is selected:
        - Extract the selected text.
        - Extract the conversation context (if available).
        - Use the configurable "Improve Text System Prompt" from settings.
        - Call the configured LLM API via the background script.
        - Replace the selected text with the LLM's response directly in the Gmail composer.
        - Ensure Gmail's native undo (Cmd+Z / Ctrl+Z) works for the replacement.

### Common Requirements
- **Activation**: Both features (icons and shortcuts) must work in both reply/forward composers and new email composers.
- **Configuration**: 
    - Retain existing settings for API Key, Model, and Prompt Template (for Generate Reply).
    - Add a new field in the extension's options page for the "Improve Text System Prompt".

## 3. Implementation Plan (Revised)

### 3.1. Options Page (`src/options/`)

1.  **Modify `options.html`**: Add a new text area input field for the "Improve Text System Prompt". Label it clearly.
2.  **Modify `options.js`**:
    *   Add logic to save/load/restore the new `improvePromptTemplate` setting.
    *   Provide a default value for the prompt: `"Correct typos and improve the message, maintaining the tone and length, keeping in mind the conversation context (if available), and the language of the draft. The selected text to improve is:\n\n[Selected_text]\n\nConversation context (if any):\n[Email_context]"`

### 3.2. Background Script (`src/background.js`)

1.  **Modify Message Listener (`chrome.runtime.onMessage`)**:
    *   Keep existing handler for `generate` message type.
    *   Keep handler for `IMPROVE_TEXT` message type (receives `selectedText`, `context`).
2.  **Implement `handleImproveText` logic** (already done):
    *   Retrieve settings (`apiKey`, `model`, `improvePromptTemplate`).
    *   Construct the API request payload using `createImprovePrompt` helper.
    *   Make the API call.
    *   Send the `IMPROVE_TEXT_RESULT` message back.

### 3.3. Content Script (`src/content.js`)

1.  **Button Creation:**
    *   Retain `createAIReplyButton` for the original feature (magic wand icon).
    *   Add `createImproveTextButton` for the new feature (pencil icon).
2.  **Button Injection:**
    *   Modify `findPreferredInjectionPoint` to return the parent container for injection.
    *   Modify `injectButtons` (renamed from `injectButton`) to create *both* buttons and append them to the injection parent. Use a single marker (`data-ai-buttons-injected`) on the compose root.
    *   Modify `cleanupAllButtons` to remove both button types and the new marker.
    *   Update MutationObserver and `injectIntoExistingWindows` to use `injectButtons`.
3.  **Keyboard Shortcut Listeners:**
    *   **`Cmd+Shift+H` Listener:** Revert to only triggering the "Generate Reply" flow (extract context, store it, call `openModal`).
    *   **`Cmd+Shift+G` Listener:** Add a new listener that specifically triggers the "Improve Text" flow (get selection, check if empty, show banner if needed, extract context, send `IMPROVE_TEXT` message).
4.  **Result Handling:**
    *   Keep `handleImproveTextResult` function to receive the response from the background script and use `document.execCommand('insertText', ...)` to replace the selected text.
5.  **Activation**: Ensure injection logic (`findPreferredInjectionPoint`, `getComposeWindows`) correctly identifies composer instances for both new emails and replies/forwards.

## 4. Considerations

*   **Gmail DOM Structure**: Selectors need to be robust.
*   **Error Handling**: Implement visual feedback (spinners, banners) for loading states and errors in both flows (Generate Reply modal and Improve Text inline action).
*   **Undo**: Test undo functionality thoroughly for the text replacement.
*   **Performance**: Keep context extraction and message passing efficient.
