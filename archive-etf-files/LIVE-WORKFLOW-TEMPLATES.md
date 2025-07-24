# Live N8N Workflow Templates Feature

## What's New
Your ETF Dashboard now automatically pulls active workflows from your n8n instance as templates!

## How It Works
1. **Automatic Discovery**: Dashboard fetches all active workflows from n8n
2. **Real-Time Templates**: Only workflows that are currently active appear as templates
3. **No Manual Management**: No need to manually create template entries
4. **Always Current**: Templates reflect your actual working n8n workflows

## Template Sources
- **🟢 Active**: Live workflows from your n8n instance (recommended)
- **📋 Manual**: Legacy templates created manually in the dashboard

## Benefits for Your ETF Business
- **Always Accurate**: Templates are real, tested workflows
- **No Sync Issues**: Templates automatically stay current with n8n
- **Proven Workflows**: Only active workflows appear (quality control)
- **Client Ready**: Deploy only workflows you know work

## Technical Implementation
- **Endpoint**: `/api/active-workflows` fetches live data
- **Fallback**: Manual templates still available if n8n unavailable
- **Real-time**: Every dashboard reload shows current active workflows
- **Filtering**: Only `active: true` workflows become templates

## Next Steps
1. **Create workflows in n8n**: Build your client automation workflows
2. **Activate them**: Only active workflows appear as templates
3. **Deploy to clients**: Use the dashboard to deploy to specific clients
4. **Scale easily**: Add new workflows in n8n, they appear automatically

Your ETF automation platform now has true integration between the dashboard and n8n workflows!