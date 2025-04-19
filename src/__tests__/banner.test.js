import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { showBanner } from '../utils/gmail.js';

describe('Error Banner Component', () => {
  // Set up DOM environment for tests
  let dom;
  let window;
  let document;
  let composeWindow;

  beforeEach(() => {
    // Create a mock Gmail compose window structure
    dom = new JSDOM(`
      <html>
        <body>
          <div aria-label="Message Body" class="compose-window">
            <div contenteditable="true" class="editable">
              Email content here
            </div>
          </div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;
    
    // Mock required browser APIs
    global.document = document;
    global.window = window;

    // Create a reference to the compose window element
    composeWindow = document.querySelector('.compose-window');
    
    // Mock setTimeout
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create and display an error banner', () => {
    const message = 'This is an error message';
    const banner = showBanner(composeWindow, message);
    
    // Check if banner was created
    expect(banner).not.toBeNull();
    
    // Check if banner container exists
    const container = composeWindow.querySelector('.ai-reply-banner-container');
    expect(container).not.toBeNull();
    
    // Check if banner is in the container
    expect(container.contains(banner)).toBe(true);
    
    // Check the banner content
    expect(banner.textContent).toContain(message);
    
    // Check banner type (default is error)
    expect(banner.className).toContain('ai-reply-banner-error');
  });

  it('should display different banner types', () => {
    // Test warning banner
    const warningBanner = showBanner(composeWindow, 'Warning message', { type: 'warning' });
    expect(warningBanner.className).toContain('ai-reply-banner-warning');
    
    // Test info banner
    const infoBanner = showBanner(composeWindow, 'Info message', { type: 'info' });
    expect(infoBanner.className).toContain('ai-reply-banner-info');
  });

  it('should close banner when close button is clicked', () => {
    const banner = showBanner(composeWindow, 'Test message');
    const container = composeWindow.querySelector('.ai-reply-banner-container');
    
    // Get close button
    const closeButton = banner.querySelector('button[aria-label="Close"]');
    expect(closeButton).not.toBeNull();
    
    // Click the close button
    closeButton.click();
    
    // Check if banner was removed
    expect(banner.parentNode).toBeNull();
  });

  it('should remove container when last banner is closed', () => {
    const banner = showBanner(composeWindow, 'Test message');
    const container = composeWindow.querySelector('.ai-reply-banner-container');
    
    // Get close button and click it
    const closeButton = banner.querySelector('button[aria-label="Close"]');
    closeButton.click();
    
    // Container should be removed when last banner is closed
    expect(composeWindow.querySelector('.ai-reply-banner-container')).toBeNull();
  });

  it('should auto-dismiss banner after timeout', () => {
    // Create banner with 2 second timeout
    const banner = showBanner(composeWindow, 'Test message', { timeout: 2000 });
    const container = composeWindow.querySelector('.ai-reply-banner-container');
    
    // Banner should exist initially
    expect(banner.parentNode).not.toBeNull();
    
    // Advance timer to just before timeout
    jest.advanceTimersByTime(1999);
    expect(banner.parentNode).not.toBeNull();
    
    // Advance timer to trigger timeout
    jest.advanceTimersByTime(1);
    expect(banner.parentNode).toBeNull();
  });

  it('should not auto-dismiss if timeout is set to 0', () => {
    // Create banner with no auto-dismiss
    const banner = showBanner(composeWindow, 'Test message', { timeout: 0 });
    
    // Advance timer well beyond normal timeout
    jest.advanceTimersByTime(10000);
    
    // Banner should still exist
    expect(banner.parentNode).not.toBeNull();
  });

  it('should handle multiple banners in the same container', () => {
    // Create multiple banners
    const banner1 = showBanner(composeWindow, 'First message');
    const banner2 = showBanner(composeWindow, 'Second message');
    const banner3 = showBanner(composeWindow, 'Third message');
    
    const container = composeWindow.querySelector('.ai-reply-banner-container');
    
    // Container should contain all banners
    expect(container.children.length).toBe(3);
    
    // Close middle banner
    const closeButton2 = banner2.querySelector('button[aria-label="Close"]');
    closeButton2.click();
    
    // Container should still exist with two banners
    expect(container.children.length).toBe(2);
    expect(container.contains(banner1)).toBe(true);
    expect(container.contains(banner2)).toBe(false);
    expect(container.contains(banner3)).toBe(true);
  });

  it('should return null if composeWindow is not provided', () => {
    const banner = showBanner(null, 'Test message');
    expect(banner).toBeNull();
  });

  it('should return null if message is not provided', () => {
    const banner = showBanner(composeWindow, '');
    expect(banner).toBeNull();
  });

  it('should handle errors gracefully', () => {
    // Mock insertBefore to throw an error
    const originalInsertBefore = composeWindow.insertBefore;
    composeWindow.insertBefore = jest.fn().mockImplementation(() => {
      throw new Error('Mock error');
    });
    
    const banner = showBanner(composeWindow, 'Test message');
    expect(banner).toBeNull();
    
    // Restore original implementation
    composeWindow.insertBefore = originalInsertBefore;
  });
}); 