# 5-Minute N8N Deployment Checklist

## What You Need (2 minutes to gather):

### 1. Render Account
- Go to [render.com](https://render.com)
- Sign up for free account
- No credit card required for basic testing

### 2. Render API Key
- In Render dashboard, go to Account → API Keys
- Click "Create API Key"
- Copy and save it somewhere safe

### 3. GitHub Repository (Optional)
- You can use our existing configuration
- Or create your own repository with our files

## Deployment Steps (3 minutes):

### Method 1: Super Easy (Automated Script)
```bash
# Run our automated deployment script
./scripts/deploy.sh -t postgres -n my-first-n8n -k YOUR_API_KEY -r https://github.com/yourusername/n8n-render-deployment

# That's it! Script does everything for you
```

### Method 2: Manual (Using Render Dashboard)
1. **Upload Configuration**
   - Copy `config/render-postgres.yaml` to your repository
   - Rename it to `render.yaml`
   - Push to GitHub

2. **Create Service in Render**
   - Go to Render dashboard
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render reads your configuration automatically

3. **Set Environment Variables**
   - In Render dashboard, go to your service
   - Add these required variables:
     - `N8N_BASIC_AUTH_PASSWORD`: Choose a strong password
     - `N8N_ENCRYPTION_KEY`: Generate with `openssl rand -hex 32`

## What Happens Next:

### 1. Render Creates Your Services
- Database service (stores your workflows)
- Web service (runs n8n interface)
- Takes about 5-10 minutes

### 2. You Get Your URLs
- Main app: `https://your-service-name.onrender.com`
- Health check: `https://your-service-name.onrender.com/healthz`

### 3. First Login
- Username: `admin`
- Password: What you set in environment variables
- You'll see the n8n welcome screen

## Your First Workflow (Try this immediately):

### Simple "Hello World" Automation
1. **Create New Workflow**
   - Click "New Workflow"
   - You'll see a blank canvas

2. **Add Schedule Trigger**
   - Search for "Schedule Trigger"
   - Set it to run "Every 5 minutes"

3. **Add Email Node**
   - Search for "Gmail" or "Send Email"
   - Configure it to send yourself a test message

4. **Connect and Test**
   - Connect the nodes with arrows
   - Click "Execute Workflow" to test
   - Check your email!

## Troubleshooting:

### If Service Won't Start:
- Check environment variables are set correctly
- Look at logs in Render dashboard
- Verify your API key is valid

### If Can't Login:
- Double-check your password in environment variables
- Try resetting the password in Render dashboard
- Make sure encryption key is exactly 64 characters

### If Workflows Don't Work:
- Check your internet connectivity
- Verify service credentials (Gmail, Slack, etc.)
- Look at execution history for error messages

## Free Tier Limitations:

### What Works on Free Tier:
- ✅ Basic workflows (up to moderate complexity)
- ✅ Most integrations and nodes
- ✅ Webhook triggers
- ✅ Scheduled workflows
- ✅ Database storage (1GB limit)

### Free Tier Restrictions:
- ⏸️ Service sleeps after 15 minutes of inactivity
- 📊 Limited to 750 hours per month
- 🐌 Slower performance than paid plans
- 💾 1GB database storage limit

### Upgrading (When Ready):
- $7/month for always-on service
- Better performance and reliability
- More storage and features
- Custom domains

## Next Steps After Deployment:

1. **Explore the Interface** (30 minutes)
   - Browse available nodes
   - Try the sample workflows we provided
   - Read built-in documentation

2. **Build Your First Real Workflow** (1 hour)
   - Choose something simple you do manually
   - Email notifications, data sync, etc.
   - Start with 2-3 steps maximum

3. **Set Up Monitoring** (15 minutes)
   - Use our health check tools
   - Set up email alerts for failures
   - Monitor execution history

4. **Join the Community**
   - n8n has a great community forum
   - Lots of workflow examples and help
   - Share your own creations

## Success Indicators:

You'll know everything is working when:
- ✅ You can login to your n8n interface
- ✅ The health check URL returns "OK"
- ✅ You can create and execute a simple workflow
- ✅ Workflow executions appear in history
- ✅ Any email/notification tests work properly

**Estimated Total Time**: 15-20 minutes from start to having your first automation running!