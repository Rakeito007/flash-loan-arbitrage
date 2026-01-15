#!/bin/bash

# Push to GitHub Helper Script

echo "🚀 Flash Loan Bot - GitHub Push Helper"
echo "========================================"
echo ""

# Check if remote exists
if git remote get-url origin &>/dev/null; then
    echo "✅ Remote already configured:"
    git remote -v
    echo ""
    echo "Pushing to GitHub..."
    git push -u origin main
else
    echo "⚠️  No remote configured yet."
    echo ""
    echo "Please provide your GitHub repository URL:"
    echo "  Example: https://github.com/yourusername/flash-loan-arbitrage.git"
    echo ""
    read -p "Enter repository URL: " repo_url
    
    if [ -z "$repo_url" ]; then
        echo "❌ No URL provided. Exiting."
        exit 1
    fi
    
    echo ""
    echo "Adding remote and pushing..."
    git remote add origin "$repo_url"
    git branch -M main
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully pushed to GitHub!"
        echo "   Repository: $repo_url"
    else
        echo ""
        echo "❌ Push failed. Please check:"
        echo "   1. Repository exists on GitHub"
        echo "   2. You have push access"
        echo "   3. Repository URL is correct"
    fi
fi
