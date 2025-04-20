#!/bin/bash
# Simple build script for Gmail AI Reply Assistant extension

# Clear previous build
rm -rf dist
mkdir -p dist

# Copy source files to dist, excluding test directories
echo "📦 Copying files to dist folder..."
mkdir -p dist/utils dist/options dist/icons

# Copy only necessary files, excluding test directories
cp src/*.js dist/
cp src/manifest.json dist/
cp -r src/utils/*.js dist/utils/
cp -r src/options/*.js dist/options/
cp -r src/options/*.html dist/options/
cp -r src/options/*.css dist/options/
cp -r src/icons/* dist/icons/

# Copy UI resources
echo "📄 Copying UI resources..."
mkdir -p dist/ui
cp ui/*.html dist/ui/
cp ui/*.css dist/ui/

# Ensure module type is correctly set
echo "🔧 Updating manifest..."
# No need to modify manifest.json as module type is already set correctly

# Zip for distribution (optional)
echo "🗜️ Creating ZIP archive..."
cd dist
zip -r ../gmail-ai-reply-assistant.zip .
cd ..

echo "✅ Build complete! Extension ready in dist/ folder"
echo "   Zip archive: gmail-ai-reply-assistant.zip"
echo "   IMPORTANT: No test directories included!" 