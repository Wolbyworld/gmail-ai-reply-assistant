# Gmail AI Reply Assistant

A Chrome extension that adds AI-powered email reply drafting to Gmail.

## Features

- 🕊️ Simple Gmail integration with a pigeon button in the compose toolbar
- 🤖 AI-generated drafts based on your talking points
- 🔒 Your API key stays in your browser (not sent to any servers)
- 🎨 Clean, accessible modal interface
- ⚡ Quick insertion of drafts directly into your compose window

## Installation (Development Mode)

Since this extension is for personal use, you'll need to load it in Chrome's developer mode:

1. Run the build script to prepare the extension:
   ```bash
   chmod +x build.sh
   ./build.sh
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable "Developer mode" using the toggle in the top-right corner

4. Click "Load unpacked" and select the `dist` folder created by the build script

5. The extension is now installed! You'll see the Gmail AI Reply Assistant in your extensions list

## Configuration

1. After installation, click on the extension's options page (right-click on the extension icon and select "Options" or find the "Options" link on the `chrome://extensions` page)

2. Enter your OpenAI API key, select your preferred model, and customize the prompt template

3. Save your settings

## Usage

1. Open Gmail in Chrome

2. Start composing a new email or reply to an existing one

3. Click the 🕊️ (pigeon) button in the compose toolbar

4. Enter your talking points in the modal that appears

5. Click "Generate" to create an AI-drafted reply

6. The draft will be inserted into your compose window

## Troubleshooting

- **Modal doesn't appear**: Make sure you're on mail.google.com and have granted the extension permissions
- **API errors**: Check your API key in the extension options
- **Draft not inserting**: Try refreshing Gmail and trying again

## Privacy

This extension:
- Stores your API key locally in Chrome's storage
- Only accesses the Gmail page when you're actively using it
- Makes API calls directly to OpenAI with your key
- Doesn't send your data to any other servers

## License

For personal use only.

## Building from Source

The extension source is organized as follows:

```
src/             - Main extension code
├── background.js  - Background service worker
├── content.js     - Gmail integration and modal handling
├── manifest.json  - Extension configuration
├── options/       - Options page
└── utils/         - Utilities
ui/              - UI resources
├── modal.css      - Modal styles
└── modal.html     - Modal HTML template
```

To build the extension, just run `./build.sh` 