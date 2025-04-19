**Gmail Chrome Extension Specification**

### Overview:
Chrome extension adds a pigeon icon at the bottom of Gmail's composer window. Clicking the icon opens a simple modal to draft an AI-generated reply using OpenAI.

### Core Functionality:

- **Icon Placement:**
  - Positioned alongside existing Gmail composer extensions.
  - Temporary pigeon placeholder icon.

- **User Interaction Flow:**
  1. Clicking the icon opens a modal.
  2. Modal has a multiline editable text input with placeholder: _"Enter bullet points or guidance for your reply..."_
  3. If text is highlighted when clicking the icon:
     - Pre-fill the input with highlighted text.
     - Editable by user.
  4. Modal closes upon:
     - Clicking "Submit" button (shows a subtle spinner/loading indicator).
     - Pressing "Esc" key or clicking outside the modal (without saving).

- **Generated Draft Behavior:**
  - Appended directly to the email body without extra spacing.
  - Cursor positioned immediately after inserted text.

### Extension Configuration (Right-click Options):
- **OpenAI Settings:**
  - API Token (stored securely).
  - Model choice dropdown: GPT-4.1, GPT-4.5.
  - Maximum token limit fixed at 1000 tokens (non-configurable).

- **Prompt Template:**
  - Default prompt:
    ```
    Write a draft response to the emails below in the context. Keep it simple, respect my tone (normally informal) and the language of the email chain.

    These are talking points:
    [Bullet_points]

    Email context:
    [Email_context]
    ```
  - Editable with "Restore to Default" option.

### Error Handling:
- Simple, friendly inline error message if OpenAI API call fails, clearly guiding users on troubleshooting steps (e.g., API token, quota).

### Compatibility:
- Supports all Gmail account types (personal/business).
- Limited to Gmail’s standard domain (`mail.google.com`).

### Analytics:
- None required.

### Edge Cases:
- Multiple Gmail accounts logged into Chrome profile use global configuration.

