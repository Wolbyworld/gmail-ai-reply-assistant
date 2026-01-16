import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get the directory name in ES Module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the path to the HTML file relative to the test file
const modalHTMLPath = path.resolve(__dirname, '../modal.html');

describe('Modal HTML Structure', () => {
  it('should match the snapshot', () => {
    const modalHTMLContent = fs.readFileSync(modalHTMLPath, 'utf8');
    // Basic check to ensure file content was read
    expect(modalHTMLContent.length).toBeGreaterThan(0);
    // Snapshot the content
    expect(modalHTMLContent).toMatchSnapshot();
  });
}); 