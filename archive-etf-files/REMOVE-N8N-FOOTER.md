# Remove "Powered by n8n" Footer

## The Issue
Telegram messages include automatic footer:
"This message was sent automatically with n8n (https://n8n.io/?utm_source=...)"

## Solution Applied
Added environment variable to render.yaml:
```yaml
N8N_HIDE_USAGE_PAGE: true
```

## How to Deploy
1. Go to Render Dashboard: https://dashboard.render.com/
2. Find your `n8n-app-gvq5` service
3. Click "Manual Deploy"
4. Wait for deployment completion

## Result
After deployment, your Telegram messages will be clean without the n8n footer.

## Alternative Method (In n8n Interface)
You can also disable this in n8n settings:
1. Go to Settings → Community Nodes
2. Look for "Hide usage statistics" option
3. Enable it

## Business Impact
Your ETF automation messages to clients will look more professional without the n8n branding footer.