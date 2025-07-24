# N8N Self-Hosted Tools

This directory contains tools for managing your N8N self-hosted instance.

## Workflow Duplicator Tool

**File**: `workflow-duplicator.js`

A powerful tool for duplicating and personalizing N8N workflows for client deployment.

### Features

- **Workflow Duplication**: Clone existing workflows with new names
- **Client Personalization**: Replace placeholders with client-specific data
- **Batch Processing**: Handle multiple workflows and clients
- **Template Management**: Identify and work with template workflows
- **Auto-Activation**: Automatically activate duplicated workflows
- **Export/Import**: Backup and restore workflows as JSON files

### Setup

1. **Install Dependencies**:
```bash
npm install axios
```

2. **Set Environment Variables**:
```bash
export N8N_BASE_URL="https://n8n-app-gvq5.onrender.com"
export N8N_API_KEY="your-api-key-here"
```

### Usage

#### Basic Workflow Duplication

```javascript
const N8NWorkflowDuplicator = require('./workflow-duplicator');

const duplicator = new N8NWorkflowDuplicator({
    baseURL: 'https://n8n-app-gvq5.onrender.com',
    apiKey: 'your-api-key'
});

// Client data for personalization
const clientData = {
    name: "Downtown Dental",
    email: "contact@downtowndental.com", 
    phone: "+1-555-123-4567",
    company: "Downtown Dental Clinic",
    businessType: "Dental Clinic",
    customFields: {
        '{{APPOINTMENT_URL}}': 'https://book.downtowndental.com'
    }
};

// Duplicate workflow
const result = await duplicator.duplicateWorkflow(
    'template-workflow-id',
    clientData,
    { activate: true }
);
```

#### Command Line Usage

```bash
# Run the duplicator with example data
node workflow-duplicator.js

# Or set custom data via environment
CLIENT_NAME="Pet Clinic Plus" node workflow-duplicator.js
```

### Placeholder System

The duplicator supports these standard placeholders:

- `{{CLIENT_NAME}}` - Client's name
- `{{CLIENT_EMAIL}}` - Client's email address
- `{{CLIENT_PHONE}}` - Client's phone number
- `{{CLIENT_COMPANY}}` - Company name
- `{{CLIENT_ADDRESS}}` - Business address
- `{{CLIENT_WEBSITE}}` - Website URL
- `{{BUSINESS_NAME}}` - Business name
- `{{BUSINESS_TYPE}}` - Type of business
- `{{SERVICE_AREA}}` - Geographic service area

Plus any custom fields you define in the `customFields` object.

### Template Workflow Format

To create template workflows:

1. **Name Convention**: End workflow names with `_TEMPLATE`
   - Example: `PET_CLINIC_TEMPLATE`

2. **Add Template Tag**: Add a tag with name `template`

3. **Use Placeholders**: Replace client-specific values with placeholders:
   ```
   Email: {{CLIENT_EMAIL}}
   Phone: {{CLIENT_PHONE}}
   Business: {{CLIENT_COMPANY}}
   ```

### Example Client Deployment

```javascript
// Deploy for multiple clients
const clients = [
    {
        name: "Downtown Pet Clinic",
        email: "info@downtownpets.com",
        phone: "+1-555-PET-CARE",
        businessType: "Veterinary Clinic"
    },
    {
        name: "Westside Animal Hospital", 
        email: "contact@westsideah.com",
        phone: "+1-555-ANIMALS",
        businessType: "Animal Hospital"
    }
];

// Deploy for each client
for (const client of clients) {
    const result = await duplicator.duplicateWorkflow(
        'pet-clinic-template-id',
        client,
        { activate: true }
    );
    console.log(`Deployed for ${client.name}:`, result.success);
}
```

### Benefits

1. **Scalable Client Onboarding**: Deploy personalized workflows in seconds
2. **Consistent Templates**: Ensure all clients get the same proven automation
3. **Easy Customization**: Client-specific data automatically injected
4. **Workflow Management**: Track which workflows belong to which clients
5. **Business Growth**: Handle unlimited clients without manual workflow creation

### Current Capacity

Based on your Render hosting:
- **Small workflows** (5-10 nodes): 8-12 active workflows
- **Medium workflows** (15-25 nodes): 3-5 active workflows  
- **Large workflows** (30+ nodes): 2-3 active workflows

Your current PET CLINIC workflow (28 nodes) allows for **3-5 simultaneous client deployments**.