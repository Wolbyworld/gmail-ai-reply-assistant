import { describe, it, expect, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { getComposeWindows } from '../gmail';

// Helper function to set up the DOM for tests
const setupDOM = (html) => {
  const dom = new JSDOM(html);
  global.document = dom.window.document;
  global.window = dom.window;
};

// Mock compose window HTML structure (simplified)
const createComposeWindowHTML = (id) => `
  <div class="gmail-compose-container">
    <div aria-label="Message Body" id="compose-${id}">
      <div class="editable">Some email content...</div>
    </div>
    <div class="toolbar">Other stuff</div>
  </div>
`;

describe('getComposeWindows', () => {
  beforeEach(() => {
    // Reset DOM before each test
    setupDOM('<!DOCTYPE html><html><body></body></html>');
  });

  it('should return an empty NodeList when no compose windows are present', () => {
    const composeWindows = getComposeWindows();
    expect(composeWindows).toBeDefined();
    expect(composeWindows.length).toBe(0);
  });

  it('should return one element when one compose window is present', () => {
    document.body.innerHTML = createComposeWindowHTML(1);
    const composeWindows = getComposeWindows();
    expect(composeWindows.length).toBe(1);
    expect(composeWindows[0].id).toBe('compose-1');
  });

  it('should return multiple elements when multiple compose windows are present', () => {
    document.body.innerHTML = createComposeWindowHTML(1) + createComposeWindowHTML(2);
    const composeWindows = getComposeWindows();
    expect(composeWindows.length).toBe(2);
    expect(composeWindows[0].id).toBe('compose-1');
    expect(composeWindows[1].id).toBe('compose-2');
  });

  it('should find newly added compose windows on subsequent calls', () => {
    // Initial call with no windows
    expect(getComposeWindows().length).toBe(0);

    // Add one window and call again
    document.body.innerHTML = createComposeWindowHTML(1);
    expect(getComposeWindows().length).toBe(1);

    // Add another window and call again
    document.body.innerHTML += createComposeWindowHTML(2);
    expect(getComposeWindows().length).toBe(2);
  });

  it('should not find elements without the correct aria-label', () => {
    document.body.innerHTML = `
      <div aria-label="Different Label">
        <div class="editable"></div>
      </div>
      ${createComposeWindowHTML(1)}
    `;
    const composeWindows = getComposeWindows();
    expect(composeWindows.length).toBe(1); // Only finds the one with the correct label
    expect(composeWindows[0].id).toBe('compose-1');
  });

  // Note: The original prompt mentioned testing live NodeList behavior.
  // querySelectorAll returns a *static* NodeList. The test
  // 'should find newly added compose windows on subsequent calls' verifies that
  // re-running the function picks up changes, which fulfills the likely intent.
}); 