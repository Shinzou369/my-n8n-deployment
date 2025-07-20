# Your N8N Deployment

This repository contains your personal n8n workflow automation platform deployed on Render.

## What You Have Deployed

- **N8N Version**: 1.102.4 (Latest stable - July 2025)
- **Database**: PostgreSQL (persistent storage)
- **Platform**: Render (cloud hosting)
- **Plan**: Free tier (perfect for testing)

## Your N8N Features

### Core Automation
- 400+ integrations (Gmail, Slack, databases, APIs)
- Visual workflow builder
- Webhook triggers and scheduled workflows
- Real-time execution monitoring

### New AI Features (v1.102.4)
- **AI Agent Tools**: Multi-agent workflow orchestration
- **Google Gemini Integration**: Direct access to Google's AI
- **Built-in Evaluations**: Quality scoring for AI responses
- **Model Selector**: Smart routing between AI models

## Access Your N8N

- **URL**: `https://YOUR-SERVICE-NAME.onrender.com`
- **Username**: `admin`
- **Password**: [The one you set in environment variables]

## Quick Start Workflows

Try these first workflows to get familiar:

### 1. Welcome Email Automation
```
Webhook Trigger → Extract Data → Send Email → Update Database
```

### 2. Daily Report Generation
```
Schedule Trigger → Database Query → Format Report → Send to Slack
```

### 3. AI-Powered Customer Support (New!)
```
Customer Question → AI Supervisor → Specialist Agents → Quality Check → Response
```

## Environment Variables Set

These are configured in your Render service:

```
✅ Database connection (automatic)
✅ Basic authentication 
✅ Webhook URLs (automatic)
✅ Performance settings
✅ AI features enabled
```

## Repository Structure

```
my-n8n-deployment/
├── render.yaml              # Render deployment configuration
├── README.md                # This file
├── .env.example            # Environment variables template
└── docs/                   # Additional documentation
    ├── workflows/          # Sample workflow examples
    ├── troubleshooting.md  # Common issues and fixes
    └── upgrade-guide.md    # How to update n8n version
```

## Support and Resources

### Official N8N Resources
- [N8N Documentation](https://docs.n8n.io/)
- [Community Forum](https://community.n8n.io/)
- [Workflow Templates](https://n8n.io/workflows/)

### Your Deployment
- Check service status in [Render Dashboard](https://dashboard.render.com/)
- View logs for troubleshooting
- Monitor database usage and performance

## Upgrading Your Plan

### Free Tier Includes
- ✅ 750 hours per month
- ✅ All n8n features
- ✅ PostgreSQL database (1GB)
- ⏸️ Service sleeps after 15 minutes inactivity

### Starter Plan ($7/month)
- ✅ Always-on service (no sleeping)
- ✅ Better performance
- ✅ More database storage
- ✅ Custom domains
- ✅ Priority support

## Next Steps

1. **Explore the Interface**: Login and browse available nodes
2. **Build Your First Workflow**: Start with a simple email automation
3. **Try AI Features**: Experiment with the new AI Agent Tools
4. **Connect Your Services**: Add Gmail, Slack, or database credentials
5. **Set Up Monitoring**: Configure alerts for workflow failures

## Troubleshooting

### Service Won't Start
- Check environment variables in Render dashboard
- Verify database connection status
- Review service logs for error messages

### Can't Login
- Confirm N8N_BASIC_AUTH_PASSWORD is set correctly
- Check N8N_ENCRYPTION_KEY is exactly 64 characters
- Try clearing browser cache

### Workflows Not Working
- Verify service credentials (API keys, passwords)
- Check execution history for error details
- Test with manual workflow execution first

---

**Deployed on**: [DATE]
**Service URL**: https://YOUR-SERVICE-NAME.onrender.com
**Database**: PostgreSQL on Render
**Repository**: https://github.com/YOUR-USERNAME/my-n8n-deployment