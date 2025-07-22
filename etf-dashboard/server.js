const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database initialization
const db = new sqlite3.Database('./etf_dashboard.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      n8n_workflow_id TEXT,
      config_fields TEXT, -- JSON string of required configuration fields
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Clients table
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      company TEXT,
      industry TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Deployments table
  db.run(`
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      n8n_workflow_id TEXT,
      workflow_name TEXT,
      status TEXT DEFAULT 'pending', -- pending, active, failed, inactive
      config_data TEXT, -- JSON string of deployment configuration
      deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(client_id) REFERENCES clients(id),
      FOREIGN KEY(template_id) REFERENCES templates(id)
    )
  `);

  // N8N connection settings
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database tables initialized');
}

// N8N API Configuration
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n-app-gvq5.onrender.com';
const N8N_API_KEY = process.env.N8N_API_KEY || '';
const N8N_EMAIL = process.env.N8N_EMAIL || 'admin';
const N8N_PASSWORD = process.env.N8N_PASSWORD || '';

// N8N Configuration Object
const N8N_CONFIG = {
  baseURL: N8N_BASE_URL,
  auth: N8N_API_KEY ? { 
    headers: { 'X-N8N-API-KEY': N8N_API_KEY } 
  } : {
    username: N8N_EMAIL,
    password: N8N_PASSWORD
  }
};

// N8N API Helper
class N8NApiClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.auth = config.auth || {};
  }

  async makeRequest(method, endpoint, data = null) {
    if (!this.baseURL || this.baseURL.trim() === '') {
      throw new Error('N8N Base URL not configured');
    }

    try {
      const config = {
        method,
        url: `${this.baseURL}/api/v1${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...this.auth.headers
        },
        timeout: 10000,
        validateStatus: function (status) {
          return status < 500; // Accept anything less than 500 as valid (including 401, 404)
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('Cannot connect to N8N - check URL and ensure N8N is running');
      }
      console.error('N8N API Error:', error.response?.data || error.message);
      throw new Error(`N8N API Error: ${error.response?.status || error.message}`);
    }
  }

  async getWorkflows() {
    return await this.makeRequest('GET', '/workflows');
  }

  async getWorkflow(id) {
    return await this.makeRequest('GET', `/workflows/${id}`);
  }

  async createWorkflow(workflowData) {
    return await this.makeRequest('POST', '/workflows', workflowData);
  }

  async updateWorkflow(id, workflowData) {
    return await this.makeRequest('PUT', `/workflows/${id}`, workflowData);
  }

  async activateWorkflow(id) {
    return await this.makeRequest('POST', `/workflows/${id}/activate`);
  }

  async deactivateWorkflow(id) {
    return await this.makeRequest('POST', `/workflows/${id}/deactivate`);
  }
}

const n8nClient = new N8NApiClient(N8N_CONFIG);

// N8N API Helper Functions
async function authenticateN8N() {
  try {
    if (N8N_API_KEY) {
      return { headers: { 'X-N8N-API-KEY': N8N_API_KEY } };
    } else {
      // Fallback to basic auth
      const auth = Buffer.from(`${N8N_EMAIL}:${N8N_PASSWORD}`).toString('base64');
      return { headers: { 'Authorization': `Basic ${auth}` } };
    }
  } catch (error) {
    console.error('N8N Authentication failed:', error);
    throw error;
  }
}

async function duplicateWorkflow(templateId, clientData, templateName) {
  try {
    const authHeaders = await authenticateN8N();

    // Get the master template
    const templateResponse = await axios.get(
      `${N8N_BASE_URL}/api/v1/workflows/${templateId}`,
      authHeaders
    );

    const template = templateResponse.data;

    // Create a new workflow with client-specific data
    const newWorkflow = {
      ...template,
      name: `[${clientData.name}] - ${templateName}`,
      id: undefined, // Remove ID to create new workflow
      nodes: template.nodes.map(node => {
        // Replace placeholder data with actual client data
        let updatedNode = JSON.parse(JSON.stringify(node));

        // Replace common placeholders in node parameters
        const nodeStr = JSON.stringify(updatedNode);
        const replacedStr = nodeStr
          .replace(/\{\{CLIENT_NAME\}\}/g, clientData.name || '')
          .replace(/\{\{CLIENT_EMAIL\}\}/g, clientData.email || '')
          .replace(/\{\{CLIENT_COMPANY\}\}/g, clientData.company || '')
          .replace(/\{\{OPENAI_API_KEY\}\}/g, clientData.openai_api_key || '')
          .replace(/\{\{GOOGLE_CALENDAR_ID\}\}/g, clientData.google_calendar_id || '')
          .replace(/\{\{SUPPORT_EMAIL\}\}/g, clientData.support_email || '')
          .replace(/\{\{BUSINESS_HOURS\}\}/g, clientData.business_hours || '9 AM - 5 PM')
          .replace(/\{\{PHONE_NUMBER\}\}/g, clientData.phone_number || '');

        return JSON.parse(replacedStr);
      })
    };

    // Create the new workflow
    const createResponse = await axios.post(
      `${N8N_BASE_URL}/api/v1/workflows`,
      newWorkflow,
      authHeaders
    );

    // Activate the workflow
    await axios.post(
      `${N8N_BASE_URL}/api/v1/workflows/${createResponse.data.id}/activate`,
      {},
      authHeaders
    );

    return createResponse.data;
  } catch (error) {
    console.error('Error duplicating workflow:', error);
    throw error;
  }
}

// Routes

// Dashboard home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Active N8N Workflows (Live Templates)
app.get('/api/active-workflows', async (req, res) => {
  try {
    console.log('🔍 Fetching workflows from n8n...');
    console.log('📡 N8N Base URL:', N8N_BASE_URL);
    console.log('🔐 Using API Key:', N8N_API_KEY ? 'Yes' : 'No');
    
    const workflows = await n8nClient.getWorkflows();
    console.log('📊 Raw workflows response:', JSON.stringify(workflows, null, 2));
    
    // Handle different response formats
    let workflowList = [];
    if (workflows && workflows.data) {
      workflowList = workflows.data;
    } else if (Array.isArray(workflows)) {
      workflowList = workflows;
    }
    
    console.log(`📋 Found ${workflowList.length} total workflows`);
    
    // Filter only active workflows
    const activeWorkflows = workflowList.filter(workflow => workflow.active === true);
    console.log(`✅ Found ${activeWorkflows.length} active workflows`);
    
    // Transform to template format for dashboard compatibility
    const templates = activeWorkflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: `Active n8n workflow: ${workflow.name}`,
      category: 'n8n-workflow',
      n8n_workflow_id: workflow.id,
      config_fields: [],
      created_at: workflow.createdAt,
      updated_at: workflow.updatedAt,
      active: workflow.active
    }));
    
    console.log('🚀 Sending templates:', templates);
    res.json(templates);
  } catch (error) {
    console.error('❌ Error fetching active workflows:', error.message);
    console.error('📋 Full error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active workflows from n8n',
      details: error.message,
      n8n_url: N8N_BASE_URL
    });
  }
});

// Templates (Legacy - kept for manual templates)
app.get('/api/templates', (req, res) => {
  db.all('SELECT * FROM templates ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Parse config_fields JSON for each template
    const templates = rows.map(row => ({
      ...row,
      config_fields: JSON.parse(row.config_fields || '[]')
    }));

    res.json(templates);
  });
});

app.post('/api/templates', (req, res) => {
  const { name, description, category, n8n_workflow_id, config_fields } = req.body;
  const id = uuidv4();

  const sql = `
    INSERT INTO templates (id, name, description, category, n8n_workflow_id, config_fields)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [id, name, description, category, n8n_workflow_id, JSON.stringify(config_fields)], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id, message: 'Template created successfully' });
  });
});

// Clients
app.get('/api/clients', (req, res) => {
  db.all('SELECT * FROM clients ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/clients', (req, res) => {
  const { name, email, company, industry } = req.body;
  const id = uuidv4();

  const sql = `
    INSERT INTO clients (id, name, email, company, industry)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(sql, [id, name, email, company, industry], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id, message: 'Client created successfully' });
  });
});

// Deployments
app.get('/api/deployments', (req, res) => {
  const sql = `
    SELECT d.*, c.name as client_name, t.name as template_name
    FROM deployments d
    JOIN clients c ON d.client_id = c.id
    JOIN templates t ON d.template_id = t.id
    ORDER BY d.deployed_at DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const deployments = rows.map(row => ({
      ...row,
      config_data: JSON.parse(row.config_data || '{}')
    }));

    res.json(deployments);
  });
});

// Deploy workflow - THE CORE FEATURE
app.post('/api/deploy', async (req, res) => {
  const { client_id, template_id, config_data } = req.body;

  try {
    // Get template and client information
    const template = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM templates WHERE id = ?', [template_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const client = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM clients WHERE id = ?', [client_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!template || !client) {
      return res.status(404).json({ error: 'Template or client not found' });
    }

    // Test N8N connection first
    try {
      await n8nClient.getWorkflows();
    } catch (error) {
      return res.status(500).json({ 
        error: 'Cannot connect to N8N instance', 
        details: 'Please check N8N settings and ensure N8N is running'
      });
    }

    // Get the master workflow from N8N
    const masterWorkflow = await n8nClient.getWorkflow(template.n8n_workflow_id);

    // Clone and customize the workflow
    const customizedWorkflow = {
      ...masterWorkflow,
      name: `[${client.name}] - ${template.name}`,
      id: undefined, // Remove ID so N8N creates a new one
      active: false, // Start inactive, we'll activate after creation
      tags: [`client:${client.name.toLowerCase().replace(/\s+/g, '-')}`, 'etf-deployed']
    };

    // Inject client configuration into workflow nodes
    customizedWorkflow.nodes = customizedWorkflow.nodes.map(node => {
      return injectConfigIntoNode(node, config_data, client);
    });

    // Create new workflow in N8N
    const newWorkflow = await n8nClient.createWorkflow(customizedWorkflow);
    console.log(`Created workflow: ${newWorkflow.name} (ID: ${newWorkflow.id})`);

    // Activate the new workflow
    await n8nClient.activateWorkflow(newWorkflow.id);
    console.log(`Activated workflow: ${newWorkflow.id}`);

    // Save deployment record
    const deploymentId = uuidv4();
    const sql = `
      INSERT INTO deployments (id, client_id, template_id, n8n_workflow_id, workflow_name, status, config_data)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `;

    db.run(sql, [
      deploymentId,
      client_id,
      template_id,
      newWorkflow.id,
      newWorkflow.name,
      JSON.stringify(config_data)
    ], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save deployment record' });
      }

      res.json({
        success: true,
        deployment_id: deploymentId,
        n8n_workflow_id: newWorkflow.id,
        workflow_name: newWorkflow.name,
        webhook_url: extractWebhookUrl(customizedWorkflow.nodes, newWorkflow.id),
        message: `Workflow successfully deployed for ${client.name}!`
      });
    });

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ 
      error: 'Deployment failed', 
      details: error.message 
    });
  }
});

// Advanced configuration injection - handles different node types
function injectConfigIntoNode(node, configData, client) {
  let updatedNode = JSON.parse(JSON.stringify(node)); // Deep clone

  // Handle different node types with specific configuration patterns
  switch (updatedNode.type) {
    case 'n8n-nodes-base.gmail':
    case 'n8n-nodes-base.emailSend':
      // Email nodes
      if (updatedNode.parameters) {
        if (configData.support_email) {
          updatedNode.parameters.fromEmail = configData.support_email;
          updatedNode.parameters.replyTo = configData.support_email;
        }
        if (configData.email_subject_prefix) {
          updatedNode.parameters.subject = `[${configData.email_subject_prefix}] ${updatedNode.parameters.subject || ''}`;
        }
      }
      break;

    case 'n8n-nodes-base.webhook':
      // Webhook nodes - create unique webhook paths
      if (updatedNode.parameters && updatedNode.parameters.path) {
        const clientSlug = client.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        updatedNode.parameters.path = `/${clientSlug}-${updatedNode.parameters.path}`;
      }
      break;

    case 'n8n-nodes-base.openAi':
    case 'n8n-nodes-base.chatOpenAi':
      // OpenAI nodes
      if (updatedNode.parameters && configData.openai_api_key) {
        // Set credential reference for OpenAI API key
        updatedNode.credentials = {
          ...updatedNode.credentials,
          openAiApi: {
            id: `openai-${client.id}`,
            name: `OpenAI - ${client.name}`
          }
        };
      }
      break;

    case 'n8n-nodes-base.googleCalendar':
      // Google Calendar nodes
      if (updatedNode.parameters && configData.google_calendar_id) {
        updatedNode.parameters.calendarId = configData.google_calendar_id;
      }
      break;

    case 'n8n-nodes-base.slack':
      // Slack nodes
      if (updatedNode.parameters && configData.slack_channel) {
        updatedNode.parameters.channel = configData.slack_channel;
      }
      break;

    case 'n8n-nodes-base.httpRequest':
      // HTTP Request nodes - update base URLs
      if (updatedNode.parameters && configData.api_base_url) {
        if (updatedNode.parameters.url) {
          updatedNode.parameters.url = updatedNode.parameters.url.replace('{{API_BASE_URL}}', configData.api_base_url);
        }
      }
      break;
  }

  // Universal placeholder replacement in all string parameters
  const nodeString = JSON.stringify(updatedNode);
  const replacedString = nodeString
    .replace(/\{\{CLIENT_NAME\}\}/g, client.name)
    .replace(/\{\{CLIENT_EMAIL\}\}/g, client.email || '')
    .replace(/\{\{CLIENT_COMPANY\}\}/g, client.company || '')
    .replace(/\{\{CLIENT_PHONE\}\}/g, client.phone_number || '')
    .replace(/\{\{SUPPORT_EMAIL\}\}/g, configData.support_email || client.email || '')
    .replace(/\{\{BUSINESS_HOURS\}\}/g, client.business_hours || '9 AM - 5 PM')
    .replace(/\{\{OPENAI_API_KEY\}\}/g, configData.openai_api_key || '')
    .replace(/\{\{GOOGLE_CALENDAR_ID\}\}/g, configData.google_calendar_id || '')
    .replace(/\{\{SLACK_CHANNEL\}\}/g, configData.slack_channel || '')
    .replace(/\{\{API_BASE_URL\}\}/g, configData.api_base_url || '');

  return JSON.parse(replacedString);
}

// Extract webhook URLs from deployed workflow
function extractWebhookUrl(nodes, workflowId) {
  const webhookNodes = nodes.filter(node => node.type === 'n8n-nodes-base.webhook');
  
  if (webhookNodes.length > 0) {
    const webhookPath = webhookNodes[0].parameters?.path || '';
    return `${N8N_BASE_URL}/webhook${webhookPath}`;
  }
  
  return null;
}

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM clients) as total_clients,
      (SELECT COUNT(*) FROM templates) as total_templates,
      (SELECT COUNT(*) FROM deployments WHERE status = 'active') as active_deployments,
      (SELECT COALESCE(SUM(CAST(JSON_EXTRACT(config_data, '$.monthly_revenue') AS REAL)), 0) FROM deployments WHERE status = 'active') as monthly_revenue
  `;

  db.get(sql, (err, row) => {
    if (err) {
      console.error('Stats query error:', err);
      res.status(500).json({ error: 'Failed to fetch stats' });
      return;
    }
    res.json(row);
  });
});

// Test N8N connection
app.get('/api/test-n8n', async (req, res) => {
  try {
    // First check if N8N is responding
    const healthCheck = await axios.get(`${N8N_CONFIG.baseURL}/healthz`, { timeout: 5000 });

    if (healthCheck.status === 200) {
      res.json({ 
        success: true, 
        workflow_count: 0,
        message: 'N8N is running - Authentication setup required'
      });
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      res.json({ 
        success: false, 
        details: 'Cannot connect to N8N instance',
        message: 'N8N connection failed - Check URL'
      });
    } else if (error.response?.status === 401) {
      res.json({ 
        success: false, 
        details: 'Authentication required - Set N8N password in settings',
        message: 'N8N authentication required'
      });
    } else {
      res.json({ 
        success: false, 
        details: error.message,
        message: 'N8N connection error'
      });
    }
  }
});

// Update N8N settings
app.post('/api/settings/n8n', (req, res) => {
  const { baseURL, username, password } = req.body;

  // Update runtime config
  N8N_CONFIG.baseURL = baseURL;
  N8N_CONFIG.auth.username = username;
  N8N_CONFIG.auth.password = password;

  // Save to database
  const settings = [
    ['n8n_base_url', baseURL],
    ['n8n_username', username],
    ['n8n_password', password]
  ];

  settings.forEach(([key, value]) => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  });

  res.json({ message: 'N8N settings updated successfully' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`ETF Management Dashboard running on port ${PORT}`);
  console.log(`Access dashboard at: http://0.0.0.0:${PORT}`);
  console.log('Dashboard ready for connections...');
});

// Keep server alive
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});