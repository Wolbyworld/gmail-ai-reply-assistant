#!/bin/bash
# Simple reload reminder script for Gmail AI Reply Assistant

clear
echo "🔄 Gmail AI Reply Assistant - Development Reload"
echo "=================================================="
echo ""
echo "✅ Files are ready (no build needed!)"
echo ""
echo "📍 Extension location:"
echo "   $(pwd)/src"
echo ""
echo "🔄 To reload extension in Chrome:"
echo "   1. Go to chrome://extensions/"
echo "   2. Find 'Gmail AI Reply Assistant'"
echo "   3. Click the ↻ (reload) icon"
echo ""
echo "🧪 Test in Gmail:"
echo "   1. Open Gmail: https://mail.google.com"
echo "   2. Press Cmd+Shift+H (reply generation)"
echo "   3. Press Cmd+Shift+G (text improvement)"
echo ""
echo "🐛 Debug logs:"
echo "   • Background: chrome://extensions/ → 'service worker'"
echo "   • Content: Gmail page → F12 → Console"
echo ""

# Optional: Open Gmail if --test flag is passed
if [ "$1" == "--test" ]; then
  echo "🌐 Opening Gmail..."
  open "https://mail.google.com"
fi

# Optional: Open Chrome extensions if --reload flag is passed
if [ "$1" == "--reload" ]; then
  echo "🌐 Opening chrome://extensions/..."
  open "chrome://extensions/"
fi
