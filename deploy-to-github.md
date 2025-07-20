# Push Your N8N Deployment to GitHub

## What We Have Ready

Your n8n deployment files are in the `github-deploy/` folder:
- `render.yaml` - Main deployment configuration
- `README.md` - Documentation for your deployment
- `.env.example` - Environment variables template
- `deployment-instructions.md` - Step-by-step guide

## Step 1: Create GitHub Repository

1. Go to GitHub.com
2. Click "New repository" 
3. Repository name: `my-n8n-deployment`
4. Set to **Public** (required for free Render)
5. **Don't** initialize with README
6. Click "Create repository"

## Step 2: Copy the Repository URL

GitHub will show you something like:
```
https://github.com/YOUR-USERNAME/my-n8n-deployment.git
```

## Step 3: Run These Commands in Replit Shell

**Open the Shell tab in Replit and run these commands one by one:**

```bash
# Go to your deployment folder
cd github-deploy

# Initialize git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Add n8n deployment configuration for Render"

# Set main branch
git branch -M main

# Add your GitHub repository (replace with your actual URL)
git remote add origin https://github.com/YOUR-USERNAME/my-n8n-deployment.git

# Push to GitHub
git push -u origin main
```

## Step 4: Replace the URL

In the command above, replace:
`https://github.com/YOUR-USERNAME/my-n8n-deployment.git`

With your actual repository URL from Step 2.

## Step 5: After Successful Push

1. Go to render.com and sign up
2. Click "New +" → "Blueprint" 
3. Connect your GitHub repository
4. Set these environment variables:
   - `N8N_BASIC_AUTH_PASSWORD` = your chosen password
   - `N8N_ENCRYPTION_KEY` = `8709edc36787eefdc672f5964dfe9554a651dc4f4cf67cd631e6c9165d8d5900`
5. Click "Apply"
6. Wait 5-10 minutes for deployment

## Your N8N Will Be Ready At:
`https://your-service-name.onrender.com`

Login with:
- Username: `admin`
- Password: whatever you set in Step 5

---

**Ready to start? Create your GitHub repository first, then run the shell commands!**