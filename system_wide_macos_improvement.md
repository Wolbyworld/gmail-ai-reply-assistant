# Specification: System-Wide Text Improvement on macOS

## 1. Overview

*   **Goal:** Create a macOS application/service that allows users to select text in *any* application and trigger an LLM-based text improvement (e.g., fixing typos, grammar) via a global keyboard shortcut.
*   **Inspiration:** Based on the functionality of the "Improve Selected Text" Chrome Extension (`spec_docs/improve_text_chrome.md`), but adapted for the entire macOS environment.
*   **Core Action:** Replace the selected text with the improved version directly, where possible.

## 2. Core Challenges vs. Browser Extension

Implementing this system-wide presents unique challenges compared to a constrained browser environment:

*   **Global Input Monitoring:** Capturing a keyboard shortcut regardless of the focused application.
*   **Accessing Arbitrary Selection:** Reliably getting the selected text from diverse applications (native, web views within apps, etc.).
*   **Universal Text Replacement:** Replacing the selected text in the source application, which lacks standard APIs across all apps.
*   **Permissions:** Requires explicit user permission for Accessibility features, which are powerful and privacy-sensitive.
*   **UI Feedback:** Providing non-intrusive feedback (loading, success, error) without a dedicated browser UI element like an extension icon or DOM access.

## 3. Proposed Architecture

A native macOS application is required, likely composed of:

*   **Main Application:** Contains settings UI, handles onboarding (permissions), and potentially manages the background agent. Built using Swift/AppKit or Objective-C/Cocoa.
*   **Background Agent/Service:** A lightweight process (potentially a Login Item or LaunchAgent) that runs persistently.
    *   Registers and listens for the global keyboard shortcut.
    *   Communicates with Accessibility APIs.
    *   Coordinates with the LLM integration component.
    *   Triggers UI feedback.
*   **LLM Integration Module:** Handles communication with the chosen LLM API. Needs secure storage for API keys.
*   **UI Elements:**
    *   **Menu Bar Extra:** Provides status indication (idle, processing, error) and access to settings/quit.
    *   **Settings Window:** Allows configuration of the shortcut, LLM API key/endpoint, and the improvement prompt.
    *   **macOS Notifications:** Used for success confirmation (optional) and error reporting.
    *   **(Optional) Temporary Overlay:** A small, temporary window near the cursor/selection showing the improved text if direct replacement fails (technically complex).

## 4. Implementation Plan Details

*   **Technology:** Native macOS development (Swift/Objective-C recommended for deep OS integration).
*   **Global Shortcut:**
    *   Use `NSEvent.addGlobalMonitorForEvents(matching:handler:)` (Swift) or Carbon Event HotKeys API for robust global listening. Requires careful handling to avoid conflicts.
    *   Make the shortcut user-configurable via the Settings window.
*   **Get Selected Text:**
    *   **Primary Method:** Utilize the macOS Accessibility APIs.
        *   Identify the focused application and its focused UI element (`AXUIElement`).
        *   Query the `kAXSelectedTextAttribute` value.
        *   Requires user permission granted via `System Settings > Privacy & Security > Accessibility`. The app must guide the user through this.
    *   **Fallback/Challenge:** Some applications might not properly implement Accessibility for text selection. Error handling is crucial. Clipboard monitoring (`NSPasteboard`) is *not* a reliable way to get the *current* selection without side effects.
*   **LLM Interaction:**
    *   Use `URLSession` (Swift) or similar for asynchronous network requests to the LLM API.
    *   Securely store API keys/secrets in the macOS Keychain.
    *   Use a configurable prompt template, defaulting to a generic proofreading/correction task similar to the V2 "generic" prompt in the Chrome extension spec. Example default: `Act as a proofreading expert. Carefully review the following text for spelling mistakes, typos, and minor grammatical errors. Correct any issues you find, but do not change the style or meaning of the original message. Return only the corrected version:

[Selected_text]`
*   **Replace Selected Text:** This is the most fragile part.
    *   **Primary Method (Accessibility):**
        *   Attempt to set the `kAXSelectedTextAttribute` (or potentially `kAXValueAttribute` if it represents the whole text field content) on the focused UI element with the improved text. This works best in standard `NSTextField`, `NSTextView`, etc.
    *   **Secondary Method (Simulated Paste):**
        *   If Accessibility write fails, copy the improved text to the `NSPasteboard`.
        *   Simulate a `Cmd+V` (Paste) keystroke using `CGEvent` APIs. This is less reliable, might fail depending on the app's context, and overwrites the user's clipboard. Use with caution, potentially as an optional behaviour.
    *   **Fallback (Notification/Overlay):**
        *   If both replacement methods fail, copy the improved text to the clipboard and show a macOS Notification indicating "Text improved and copied to clipboard."
        *   A temporary overlay is complex but could display the text and a copy button.
*   **UI Feedback:**
    *   Use a `NSStatusItem` for the menu bar icon, changing its appearance/image to reflect state.
    *   Use the `UserNotifications` framework to display notifications.
*   **Settings:**
    *   Create a standard `NSWindowController` / `NSViewController` for settings.
    *   Use `UserDefaults` for storing the shortcut and prompt.
    *   Use Keychain Access for API keys.
*   **Permissions Handling:**
    *   On first launch or first trigger attempt, detect if Accessibility access is granted.
    *   If not, present clear instructions and a button to open `System Settings > Privacy & Security > Accessibility` for the user.

## 5. Key Considerations

*   **Accessibility Permissions:** The app is non-functional without them. The user onboarding flow must be clear and helpful.
*   **Application Compatibility:** Text selection and replacement reliability will vary *significantly* across different macOS applications. Extensive testing and robust error handling/fallbacks are essential. Some apps (especially cross-platform ones or those using non-standard UI toolkits) might not work well.
*   **Performance:** The background agent must be lightweight. Accessibility interactions and LLM calls should be asynchronous to avoid blocking the main thread or the user's active application.
*   **Security:** Keychain must be used for sensitive data like API keys. Be mindful of the data being sent to the LLM.
*   **User Experience:** The process should feel quick. Feedback via the menu bar and notifications is crucial. The potential disruption of simulating paste needs careful consideration. Providing the improved text via clipboard + notification is often the safest fallback.
*   **LLM Choice & Cost:** Select an appropriate LLM API. Consider latency and cost implications.

## 6. Distribution

*   Package as a standard `.app` bundle.
*   Requires notarization by Apple to pass Gatekeeper checks if distributed outside the Mac App Store.
*   Distribution via the Mac App Store might be challenging due to the use of Accessibility APIs and global keyboard shortcuts, requiring careful justification and potentially sandboxing limitations. 