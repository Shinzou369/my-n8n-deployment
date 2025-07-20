#!/bin/bash

echo "🚀 N8N GitHub Deployment Script"
echo "================================="
echo ""

# Check if repository URL is provided
if [ -z "$1" ]; then
    echo "Usage: ./push-to-github.sh https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git"
    echo ""
    echo "Example: ./push-to-github.sh https://github.com/john/my-n8n-deployment.git"
    exit 1
fi

REPO_URL=$1

echo "📁 Setting up git repository..."
cd github-deploy

echo "✅ Adding files to git..."
git add .

echo "📝 Creating commit..."
git commit -m "Add n8n deployment configuration for Render

- N8N version 1.102.4 (latest stable)
- PostgreSQL database configuration  
- Render deployment ready
- Free tier compatible
- AI features enabled"

echo "🌿 Setting up main branch..."
git branch -M main

echo "🔗 Adding remote repository..."
git remote add origin $REPO_URL

echo "📤 Pushing to GitHub..."
git push -u origin main

echo ""
echo "🎉 SUCCESS! Your files are now on GitHub!"
echo ""
echo "Next steps:"
echo "1. Go to render.com and sign up"
echo "2. New + → Blueprint → Connect your repository"
echo "3. Set environment variables:"
echo "   - N8N_BASIC_AUTH_PASSWORD = [your password]"
echo "   - N8N_ENCRYPTION_KEY = 8709edc36787eefdc672f5964dfe9554a651dc4f4cf67cd631e6c9165d8d5900"
echo "4. Click Apply and wait 5-10 minutes"
echo "5. Visit your n8n URL and login!"
echo ""