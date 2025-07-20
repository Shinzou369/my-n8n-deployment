# Connect ETF Dashboard to Your N8N Instance

## Step 1: Get Your N8N Details

From your Render deployment, you should have:
- **N8N URL**: `https://n8n-app-xxxx.onrender.com`
- **Username**: `admin`
- **Password**: The password you set in Render environment variables

## Step 2: Configure Dashboard Connection

1. Open your ETF Dashboard at: http://localhost:5000
2. Click the "N8N Settings" card
3. Fill in the form:
   - **N8N Base URL**: Your Render n8n URL
   - **Username**: admin
   - **Password**: Your n8n password
4. Click "Test Connection" to verify
5. Click "Update Settings" to save

## Step 3: Test the Connection

Once connected, the dashboard will show:
- Green status: "Connected to N8N (X workflows available)"
- Your dashboard statistics will update
- You can start managing templates and deploying workflows

## Step 4: Create Your First ETF Template

1. **In N8N**: Create a master workflow (your template)
   - Build workflow with placeholder values
   - Note the workflow ID from the URL
   
2. **In Dashboard**: Add the template
   - Click "Manage Templates"
   - Add template name, description, category
   - Enter the N8N workflow ID
   - Define configuration fields clients will need

## Step 5: Add Your First Client

1. Click "Manage Clients"
2. Add client details (name, company, industry)
3. Save client information

## Step 6: Deploy Your First Workflow

1. Click "Deploy New Workflow"
2. Select client and template
3. Fill in client-specific configuration
4. Hit "Deploy" - the system will:
   - Clone the master workflow
   - Inject client data
   - Activate the customized workflow
   - Show success confirmation

## Troubleshooting

**Connection Failed**:
- Verify N8N is fully deployed and accessible
- Check credentials are correct
- Ensure N8N allows API access (basic auth is enabled)

**Deployment Failed**:
- Verify template workflow ID exists in N8N
- Check client configuration data is complete
- Review server logs for specific errors

Your ETF business automation system will be ready to scale!