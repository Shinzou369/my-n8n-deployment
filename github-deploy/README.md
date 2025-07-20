# My N8N Automation Platform

Personal n8n workflow automation platform deployed on Render with PostgreSQL database.

## What's Deployed

- **N8N Version**: 1.102.4 (Latest stable - July 2025)
- **Database**: PostgreSQL (persistent storage)  
- **Platform**: Render (cloud hosting)
- **Plan**: Free tier (750 hours/month)

## Access Details

- **URL**: `https://YOUR-SERVICE-NAME.onrender.com`
- **Username**: `admin`
- **Password**: [Set in Render environment variables]

## Features Available

### Core Automation
- 400+ integrations (Gmail, Slack, databases, APIs)
- Visual drag-and-drop workflow builder
- Webhook triggers and scheduled workflows
- Real-time execution monitoring

### AI Features (New in v1.102.4)
- **AI Agent Tools**: Multi-agent workflow orchestration
- **Google Gemini Integration**: Direct access to Google's AI model
- **Built-in Evaluations**: Quality scoring for AI responses
- **Model Selector**: Smart routing between AI models

## Quick Start Workflows

### 1. Welcome Email Automation
```
Webhook → Extract Customer Data → Send Welcome Email → Save to Database
```

### 2. Daily Business Reports  
```
Schedule Trigger → Query Database → Generate Report → Send to Slack
```

### 3. AI-Powered Support (New!)
```
Customer Question → AI Supervisor → Specialist Agents → Quality Check → Response
```

## Environment Variables Required

Set these in your Render service dashboard:

```
N8N_BASIC_AUTH_PASSWORD=your-secure-password
N8N_ENCRYPTION_KEY=8709edc36787eefdc672f5964dfe9554a651dc4f4cf67cd631e6c9165d8d5900
```

Optional (for AI features):
```
OPENAI_API_KEY=your-openai-key
GOOGLE_AI_API_KEY=your-google-gemini-key
```

## Support Resources

- [N8N Documentation](https://docs.n8n.io/)
- [Community Forum](https://community.n8n.io/)
- [Workflow Templates](https://n8n.io/workflows/)

## Upgrading

### Free Tier Limitations
- Service sleeps after 15 minutes inactivity
- 750 hours per month usage
- 1GB database storage

### Starter Plan ($7/month)
- Always-on service (no sleeping)
- Better performance and reliability
- More database storage
- Custom domains

## Next Steps

1. Login to your n8n interface
2. Explore available integrations
3. Build your first automation workflow
4. Connect your favorite services (Gmail, Slack, etc.)
5. Try the new AI features for advanced workflows

---

**Deployed**: Ready for your automation needs
**Repository**: Your personal n8n deployment configuration