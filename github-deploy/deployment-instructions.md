# Deployment Instructions

## Your Deployment Details

**Generated Encryption Key**: `8709edc36787eefdc672f5964dfe9554a651dc4f4cf67cd631e6c9165d8d5900`
**Username**: `admin`
**Password**: Choose your own secure password

## Steps to Deploy on Render

### 1. Create Render Account
- Go to [render.com](https://render.com)
- Sign up for free (use GitHub login for easier setup)
- Verify your email

### 2. Deploy from GitHub
- In Render dashboard: New + → Blueprint
- Connect this GitHub repository
- Render will detect the `render.yaml` file automatically

### 3. Set Environment Variables
When prompted, set these two required variables:
```
N8N_BASIC_AUTH_PASSWORD = [your chosen password]
N8N_ENCRYPTION_KEY = 8709edc36787eefdc672f5964dfe9554a651dc4f4cf67cd631e6c9165d8d5900
```

### 4. Deploy
- Click "Apply"
- Wait 5-10 minutes for deployment to complete
- Get your URL from the Render dashboard

### 5. First Login
- Visit your n8n URL
- Login with username `admin` and your chosen password
- Start building automation workflows!

## What You Get

- Personal n8n automation platform
- PostgreSQL database (persistent storage)
- All latest features including AI capabilities
- Free tier: 750 hours/month (plenty for testing)

## Free Tier vs Paid

### Free Tier (Perfect for Testing)
- ✅ All n8n features
- ✅ 750 hours per month
- ⏸️ Sleeps after 15 minutes inactivity
- ✅ 1GB database storage

### Starter Plan ($7/month)
- ✅ Always-on (no sleeping)
- ✅ Better performance
- ✅ More storage
- ✅ Custom domains

## Troubleshooting

### Service Won't Start
- Check environment variables are set correctly
- Verify encryption key is exactly 64 characters
- Review logs in Render dashboard

### Can't Login
- Confirm password is set correctly
- Try clearing browser cache
- Check service is running (not in error state)

### Need Help?
- Check [N8N Documentation](https://docs.n8n.io/)
- Visit [Community Forum](https://community.n8n.io/)
- Review Render service logs for specific errors

---

**Total Setup Time**: ~10 minutes
**Monthly Cost**: Free (with usage limits)
**Result**: Your personal automation platform ready to use!