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
const N8N_CONFIG = {
  baseURL: process.env.N8N_BASE_URL || 'https://n8n-app-gvq5.onrender.com',
  auth: {
    username: process.env.N8N_USERNAME || 'admin',
    password: process.env.N8N_PASSWORD || 'admin123'
  }
};

// N8N API Helper
class N8NApiClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.auth = config.auth;
  }

  async makeRequest(method, endpoint, data = null) {
    if (!this.baseURL || this.baseURL.trim() === '') {
      throw new Error('N8N Base URL not configured');
    }

    try {
      const config = {
        method,
        url: `${this.baseURL}/api/v1${endpoint}`,
        auth: this.auth,
        headers: {
          'Content-Type': 'application/json'
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

// Routes

// Dashboard home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all templates
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

// Create new template
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

// Get all clients
app.get('/api/clients', (req, res) => {
  db.all('SELECT * FROM clients ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new client
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

// Get all deployments
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
    
    // Get the master workflow from N8N
    const masterWorkflow = await n8nClient.getWorkflow(template.n8n_workflow_id);
    
    // Clone and customize the workflow
    const customizedWorkflow = {
      ...masterWorkflow,
      name: `[${client.name}] - ${template.name}`,
      id: undefined // Remove ID so N8N creates a new one
    };
    
    // Inject client configuration into workflow nodes
    customizedWorkflow.nodes = customizedWorkflow.nodes.map(node => {
      // This is where we inject client-specific data into nodes
      // Implementation depends on your specific workflow structures
      return injectConfigIntoNode(node, config_data);
    });
    
    // Create new workflow in N8N
    const newWorkflow = await n8nClient.createWorkflow(customizedWorkflow);
    
    // Activate the new workflow
    await n8nClient.activateWorkflow(newWorkflow.id);
    
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
        message: 'Workflow deployed and activated successfully'
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

// Helper function to inject configuration into workflow nodes
function injectConfigIntoNode(node, configData) {
  // This function needs to be customized based on your workflow patterns
  // For now, it's a placeholder that shows the concept
  
  if (node.parameters) {
    Object.keys(configData).forEach(key => {
      if (node.parameters[key] !== undefined) {
        node.parameters[key] = configData[key];
      }
    });
  }
  
  return node;
}

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