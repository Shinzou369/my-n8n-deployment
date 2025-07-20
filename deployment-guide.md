# Deploy N8N on Render via GitHub - Step by Step

## Step 1: Prepare Your GitHub Repository (5 minutes)

### 1.1 Create New Repository
1. Go to [GitHub.com](https://github.com)
2. Click "New repository" (green button)
3. Name it: `my-n8n-deployment` (or anything you prefer)
4. Select "Public" (required for free Render plan)
5. Check "Add a README file"
6. Click "Create repository"

### 1.2 Clone and Add Files
```bash
# Clone your new repository
git clone https://github.com/YOUR_USERNAME/my-n8n-deployment.git
cd my-n8n-deployment

# You'll add our files here (I'll provide them below)
```

## Step 2: Get Your Files Ready

I'll create all the files you need. Copy these into your repository:

### Main Configuration File: `render.yaml`
(This tells Render how to deploy n8n)

### Environment Setup: `.env.example`
(Template for your environment variables)

### Documentation: `README.md`
(Instructions for your deployed n8n)

## Step 3: Set Up Render Account (2 minutes)

### 3.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Click "Get Started for Free"
3. Sign up with GitHub (recommended)
4. Verify your email

### 3.2 Connect GitHub
1. In Render dashboard, your GitHub should auto-connect
2. If not, go to Account → Connected Accounts → Connect GitHub

## Step 4: Deploy on Render (3 minutes)

### 4.1 Create New Service
1. In Render dashboard, click "New +"
2. Select "Blueprint"
3. Connect your `my-n8n-deployment` repository
4. Render will automatically detect the `render.yaml` file

### 4.2 Configure Environment Variables
Render will ask for these (I'll give you the values):
- `N8N_BASIC_AUTH_PASSWORD` - Your login password
- `N8N_ENCRYPTION_KEY` - Security key (I'll generate this)

### 4.3 Deploy
1. Click "Apply" 
2. Wait 5-10 minutes for deployment
3. Get your URL: `https://YOUR_SERVICE_NAME.onrender.com`

## Step 5: First Login and Setup (2 minutes)

1. Visit your n8n URL
2. Login with:
   - Username: `admin`
   - Password: [what you set above]
3. Start building workflows!

---

**Total Time**: About 15 minutes from start to finish
**Cost**: Free (with free tier limitations)
**Result**: Your own n8n instance with the latest features