# ETF Management Dashboard

**Ergovia TaskForce Management Dashboard** - Your internal control center for managing n8n workflow automation business.

## What This Dashboard Does

This is your **backend office** for running your n8n automation business. It solves the core problem of manually deploying and managing client workflows by providing:

### Core Features

1. **Template Management**: Store and manage your master ETF workflow templates
2. **Client Management**: Keep track of clients who need automation workflows
3. **Automated Deployment**: The main feature - automatically clone n8n workflows, inject client data, and deploy
4. **Business Dashboard**: Monitor active deployments, revenue, and business metrics

### The Deploy Workflow Process (Your Money Maker)

1. **Select Client & Template**: Choose client and which ETF template to deploy
2. **Fill Configuration**: Dynamic form shows fields needed (API keys, credentials, settings)
3. **Hit Deploy**: System automatically:
   - Clones master workflow from n8n
   - Injects client-specific data into workflow nodes
   - Renames workflow to "[Client] - Template Name"
   - Activates the workflow in n8n
4. **Client Gets Automation**: Their custom workflow is live and running

## Quick Start

### 1. Install Dependencies
```bash
cd etf-dashboard
npm install
```

### 2. Set Environment Variables
```bash
# Your n8n instance details (from Render deployment)
N8N_BASE_URL=https://your-n8n-app.onrender.com
N8N_USERNAME=admin
N8N_PASSWORD=your-n8n-password
PORT=3000
```

### 3. Start Dashboard
```bash
npm start
```

Access at: `http://localhost:3000`

### 4. Configure N8N Connection
- Click "N8N Settings" in dashboard
- Enter your n8n URL and credentials
- Test connection to verify

## How to Use

### Adding Templates
1. Create master workflow in n8n
2. Note the workflow ID from n8n URL
3. Add template in dashboard with workflow ID
4. Define configuration fields clients need

### Adding Clients
1. Add client information (name, company, industry)
2. Keep their contact details for workflow setup

### Deploying Workflows
1. Click "Deploy New Workflow"
2. Select client and template
3. Fill in client-specific configuration
4. Deploy - workflow goes live automatically

## Business Benefits

- **Scale Fast**: Deploy workflows in minutes, not hours
- **Reduce Errors**: Automated deployment eliminates manual mistakes
- **More Clients**: Handle more clients without proportional time increase
- **Professional**: Clients get properly named, configured workflows
- **Profitable**: Turn template creation into recurring revenue

## Technical Architecture

### Frontend
- Clean, professional web interface
- Dynamic forms based on template requirements
- Real-time deployment status
- Business metrics dashboard

### Backend
- Express.js API server
- SQLite database for templates/clients/deployments
- N8N API integration for workflow management
- Automated workflow cloning and configuration

### Database Schema
- **Templates**: Master workflow definitions and config requirements
- **Clients**: Customer information and contact details
- **Deployments**: Active workflow instances and their configurations
- **Settings**: N8N connection and system configuration

## Future Enhancements

- Client portal for self-service workflow management
- Automated billing integration
- Workflow performance monitoring
- Template marketplace
- Multi-tenant n8n instance management

---

**This dashboard transforms your n8n expertise into a scalable, profitable automation business.**