#!/bin/bash
# Comprehensive fix script for silent .catch handlers
# This script replaces all `.catch(() => {})` patterns with proper error logging
# Usage: bash fix-catch-handlers.sh

echo "🔧 Starting comprehensive catch handler fixes..."
echo ""

cd "$(dirname "$0")" || exit

# Counter for files processed
processed=0
total=0

# Find all .js files and count them
total=$(find . -name "*.js" -type f | grep -E "src/(commands|slashCommands|utils|events|services)" | wc -l)

echo "Found approximately $total files to process"
echo ""

# Function to fix a single file
fix_file() {
    local file="$1"
    if grep -q "\.catch(() => {})" "$file" 2>/dev/null; then
        echo "  ✓ Fixed $file"
        ((processed++))
        
        # Replace simple .catch handlers with logging
        sed -i 's/\.catch(() => {})/\.catch(err => { try { console\.warn('\''Error (silent):'\'', err?.message); } catch (e) {} })/g' "$file"
        sed -i 's/\.catch(() => null)/\.catch(() => null)/g' "$file"
        sed -i 's/\.catch(() => false)/\.catch(() => false)/g' "$file"
    fi
}

# Process all slash commands
echo "Processing slash commands..."
for file in src/slashCommands/*/*.js; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo "Processing music commands..."
for file in src/commands/music/*.js; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo "Processing other commands..."
for file in src/commands/*/*.js; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo "Processing event handlers..."
for file in src/events/*/*.js; do
    if [ -f "$file" ]; then
        fix_file "$file"
    fi
done

echo ""
echo "✅ Complete! Fixed $processed files with silent catch handlers"
echo ""
echo "Next steps:"
echo "1. Test the bot thoroughly"
echo "2. Check logs for any new error messages from the catch handlers"
echo "3. Report any errors to help identify other issues"
