
# ETF Workflow Duplication - Setup Guide

## Installation Steps

### 1. Copy Files to Your Project

```bash
# Copy the core files
cp -r TRANSFER-PACKAGE/core/ ./
cp -r TRANSFER-PACKAGE/server/ ./
cp -r TRANSFER-PACKAGE/frontend/ ./public/
```

### 2. Install Dependencies

```bash
npm install axios express cors body-parser dotenv
```

### 3. Environment Configuration

Create `.env` file with these variables:

```bash
# N8N Configuration
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=your-n8n-api-key

# Server Configuration  
PORT=5000
NODE_ENV=production

# ETF Configuration (Optional)
DEFAULT_TEMPLATE_FOLDER=Templates/General
DEFAULT_CLIENT_FOLDER=Clients/General
AUTO_ORGANIZE_FOLDERS=true
```

### 4. Integrate with Your Express Server

```javascript
const express = require('express');
const { setupETFRoutes } = require('./server/routes');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Add ETF routes
setupETFRoutes(app);

// Your existing routes...

app.listen(5000, '0.0.0.0', () => {
    console.log('🚀 Server with ETF functionality running on port 5000');
});
```

### 5. Configure N8N Templates

In your N8N instance:

1. **Create template workflows** with placeholders like `{{CLIENT_NAME}}`
2. **Name them appropriately**: End with "_TEMPLATE" or add "template" tag
3. **Test the templates** manually first
4. **Note the workflow IDs** for configuration

### 6. Test the Setup

```bash
# Start your server
npm start

# Test ETF endpoint
curl -X POST http://localhost:5000/api/etf/health

# Test template fetching
curl http://localhost:5000/api/etf/templates
```

## Frontend Integration

Add the ETF form to your HTML:

```html
<!DOCTYPE html>
<html>
<head>
    <title>ETF Workflow Setup</title>
</head>
<body>
    <div id="etf-container">
        <!-- ETF form will be loaded here -->
    </div>
    <script src="etf-form.js"></script>
</body>
</html>
```

## Usage Examples

### ETF Onboarding Request

```javascript
const etfData = {
    name: "Downtown Pet Clinic",
    email: "info@downtownpets.com",
    phone: "+1-555-PET-CARE", 
    businessType: "Pet Clinic",
    workflowType: "etf",
    customFields: {
        '{{CLINIC_ADDRESS}}': '123 Main St',
        '{{APPOINTMENT_URL}}': 'https://book.clinic.com'
    }
};

const response = await fetch('/api/onboard-etf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(etfData)
});

const result = await response.json();
console.log('ETF Setup Result:', result);
```

### Check Client Status

```javascript
const status = await fetch('/api/etf/status/Downtown Pet Clinic');
const data = await status.json();
console.log(`Client has ${data.totalWorkflows} workflows`);
```

## Troubleshooting

### Common Issues

1. **N8N Connection Failed**
   - Check N8N_BASE_URL and N8N_API_KEY
   - Verify N8N instance is accessible
   - Test with: `curl https://your-n8n.com/api/v1/workflows`

2. **No Templates Found**
   - Ensure workflows are named with "_TEMPLATE" suffix
   - Or add "template" tag to workflows
   - Check workflows aren't archived

3. **Duplication Creates Single Workflow**
   - Verify `workflowType: 'etf'` is set
   - Check duplicateWorkflowFolder is being called
   - Review logs for ETF detection

4. **Placeholders Not Replaced**
   - Use double curly braces: `{{PLACEHOLDER}}`
   - Check clientData contains the placeholder values
   - Verify placeholder names match exactly

### Debug Mode

Enable detailed logging:

```javascript
// Add to your server startup
process.env.DEBUG_ETF = 'true';
```

## Production Deployment

1. **Set secure environment variables**
2. **Use HTTPS for N8N instance**
3. **Monitor workflow creation logs**
4. **Set up error alerting**
5. **Test with sample clients first**

## Success Metrics

A properly working ETF setup will:
- ✅ Create multiple workflows per client
- ✅ Replace all placeholders correctly  
- ✅ Organize workflows in folders automatically
- ✅ Activate all workflows successfully
- ✅ Handle errors gracefully with detailed logging

You're now ready to deploy ETF workflow duplication in your project!
