require('dotenv').config();
const express = require("express");
const path = require("path");
const OpenAI = require('openai');
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth setup
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      passReqToCallback: true,
    },
    (request, accessToken, refreshToken, profile, done) => {
      // Use the profile information (profile.id) to check if the user exists in your database
      // If the user exists, retrieve the user object from the database
      // If the user doesn't exist, create a new user object in the database
      // Pass the user object to the done() function
      return done(null, profile);
    }
  )
);

// Serialize user
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser((user, done) => {
  done(null, user);
});

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// N8N Configuration for ETF
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://n8n-app-gvq5.onrender.com';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// N8N API Helper Class
class N8NApiClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.auth = config.auth || {};
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}/api/v1${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': N8N_API_KEY
        },
        timeout: 10000
      };

      if (data) config.data = data;
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('N8N API Error:', error.response?.data || error.message);
      throw new Error(`N8N API Error: ${error.response?.status || error.message}`);
    }
  }

  async getWorkflows() { return await this.makeRequest('GET', '/workflows'); }
  async getWorkflow(id) { return await this.makeRequest('GET', `/workflows/${id}`); }
  async createWorkflow(workflowData) { return await this.makeRequest('POST', '/workflows', workflowData); }
  async activateWorkflow(id) { return await this.makeRequest('POST', `/workflows/${id}/activate`); }
}

const n8nClient = new N8NApiClient({ baseURL: N8N_BASE_URL });

// User storage functions
const fs = require('fs');
const usersFile = 'users.json';
const threadsFile = 'user_threads.json';

// Initialize ETF database tables
function initETFDatabase() {
  const db = new sqlite3.Database('etf_data.db');

  // Clients table
  db.run(`
    CREATE TABLE IF NOT EXISTS etf_clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      industry TEXT,
      taskforce_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Deployments table
  db.run(`
    CREATE TABLE IF NOT EXISTS etf_deployments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      n8n_workflow_id TEXT,
      workflow_name TEXT,
      taskforce_type TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      config_data TEXT,
      deployed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(client_id) REFERENCES etf_clients(id)
    )
  `);

  console.log('ETF Database initialized');
  return db;
}

const etfDB = initETFDatabase();

// Middleware to check if user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/auth/google");
};

// Authentication routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Successful authentication, redirect home.
    res.redirect("/");
  }
);

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// Protected route example
app.get("/profile", ensureAuthenticated, (req, res) => {
  res.send(`<h1>Hello ${req.user.displayName}</h1><a href='/logout'>Logout</a>`);
});

// Message API
app.post("/api/message", async (req, res) => {
  const { message } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI Error:", error);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

// ETF Taskforce Routes
// Taskforce-specific onboarding routes
app.get('/taskforce/:type/onboard', (req, res) => {
  const taskforceType = req.params.type;
  res.sendFile(path.join(__dirname, 'public', 'taskforce-onboard.html'));
});

// Get active workflows for specific taskforce
app.get('/api/taskforce/:type/templates', async (req, res) => {
  try {
    const taskforceType = req.params.type;
    const workflows = await n8nClient.getWorkflows();

    // Filter workflows by taskforce type (based on workflow name patterns)
    const taskforceWorkflows = workflows.data ? 
      workflows.data.filter(workflow => 
        workflow.active === true && 
        workflow.name.toLowerCase().includes(taskforceType.toLowerCase())
      ) : [];

    const templates = taskforceWorkflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: `${taskforceType} automation workflow`,
      taskforce_type: taskforceType,
      config_fields: analyzeWorkflowForTaskforce(workflow, taskforceType),
      created_at: workflow.createdAt,
      updated_at: workflow.updatedAt
    }));

    res.json(templates);
  } catch (error) {
    console.error('Error fetching taskforce templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Deploy personalized workflow for client
app.post('/api/taskforce/:type/deploy', async (req, res) => {
  try {
    const taskforceType = req.params.type;
    const { client_data, config_data, template_id } = req.body;

    console.log(`Deploying ${taskforceType} workflow for ${client_data.name}`);

    // Get the template workflow
    const originalWorkflow = await n8nClient.getWorkflow(template_id);

    // Create personalized workflow
    const personalizedWorkflow = {
      ...originalWorkflow,
      name: `${originalWorkflow.name} - ${client_data.name}`,
      id: undefined, // Remove ID to create new workflow
      nodes: personalizeWorkflowNodes(originalWorkflow.nodes, config_data, client_data, taskforceType)
    };

    // Create and activate new workflow
    const newWorkflow = await n8nClient.createWorkflow(personalizedWorkflow);
    await n8nClient.activateWorkflow(newWorkflow.id);

    // Save client and deployment records
    const client_id = uuidv4();
    const deployment_id = uuidv4();

    // Insert client
    await new Promise((resolve, reject) => {
      etfDB.run(
        `INSERT INTO etf_clients (id, name, email, company, industry, taskforce_type) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [client_id, client_data.name, client_data.email, client_data.company || client_data.name, 
         client_data.industry || taskforceType, taskforceType],
        (err) => err ? reject(err) : resolve()
      );
    });

    // Insert deployment
    await new Promise((resolve, reject) => {
      etfDB.run(
        `INSERT INTO etf_deployments (id, client_id, template_id, n8n_workflow_id, workflow_name, taskforce_type, config_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [deployment_id, client_id, template_id, newWorkflow.id, newWorkflow.name, taskforceType, JSON.stringify(config_data)],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.json({
      success: true,
      workflow_id: newWorkflow.id,
      workflow_name: newWorkflow.name,
      client_id: client_id,
      deployment_id: deployment_id,
      message: `${taskforceType} automation deployed successfully for ${client_data.name}`
    });

  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({ error: 'Deployment failed', details: error.message });
  }
});

// Google OAuth routes with proper account selection

// User storage functions
const loadUsers = () => {
  try {
    const data = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading users file:", err);
    return [];
  }
};

const saveUsers = (users) => {
  try {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Error writing users file:", err);
  }
};

let users = loadUsers();

const findUser = (googleId) => {
  return users.find(user => user.googleId === googleId);
};

const createUser = (profile) => {
  const newUser = {
    googleId: profile.id,
    email: profile.emails[0].value,
    displayName: profile.displayName,
    threads: []
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
};

// Thread storage functions
const loadThreads = () => {
    try {
        const data = fs.readFileSync(threadsFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading threads file:", err);
        return {};
    }
};

const saveThreads = (threads) => {
    try {
        fs.writeFileSync(threadsFile, JSON.stringify(threads, null, 2));
    } catch (err) {
        console.error("Error writing threads file:", err);
    }
};

let userThreads = loadThreads();

// Store thread for user
const storeThreadForUser = (googleId, threadId) => {
    if (!userThreads[googleId]) {
        userThreads[googleId] = [];
    }
    userThreads[googleId].push(threadId);
    saveThreads(userThreads);
};

// Get threads for user
const getThreadsForUser = (googleId) => {
    return userThreads[googleId] || [];
};

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ETF Helper Functions
function analyzeWorkflowForTaskforce(workflow, taskforceType) {
  const commonFields = [
    { key: 'business_name', label: 'Business Name', type: 'text', required: true },
    { key: 'business_email', label: 'Business Email', type: 'email', required: true },
    { key: 'business_phone', label: 'Business Phone', type: 'tel', required: true }
  ];

  // Taskforce-specific fields
  const taskforceFields = {
    'dental': [
      { key: 'practice_name', label: 'Practice Name', type: 'text', required: true },
      { key: 'appointment_booking_url', label: 'Appointment Booking URL', type: 'url', required: false }
    ],
    'gym': [
      { key: 'gym_name', label: 'Gym Name', type: 'text', required: true },
      { key: 'membership_system', label: 'Membership System', type: 'text', required: false }
    ],
    'contractors': [
      { key: 'service_type', label: 'Service Type', type: 'select', options: ['Plumbing', 'HVAC', 'Electrical'], required: true },
      { key: 'service_area', label: 'Service Area', type: 'text', required: true }
    ],
    'tutoring': [
      { key: 'center_name', label: 'Center Name', type: 'text', required: true },
      { key: 'subjects_offered', label: 'Subjects Offered', type: 'text', required: true }
    ],
    'massage': [
      { key: 'clinic_name', label: 'Clinic Name', type: 'text', required: true },
      { key: 'services_offered', label: 'Services Offered', type: 'text', required: true }
    ]
  };

  return [...commonFields, ...(taskforceFields[taskforceType.toLowerCase()] || [])];
}

function personalizeWorkflowNodes(nodes, configData, clientData, taskforceType) {
  return nodes.map(node => {
    const personalizedNode = { ...node };

    // Replace placeholders in node parameters
    if (personalizedNode.parameters) {
      personalizedNode.parameters = personalizeParameters(
        personalizedNode.parameters, 
        configData, 
        clientData,
        taskforceType
      );
    }

    return personalizedNode;
  });
}

function personalizeParameters(parameters, configData, clientData, taskforceType) {
  const substitutions = {
    '{{CLIENT_NAME}}': clientData.name,
    '{{CLIENT_EMAIL}}': clientData.email,
    '{{CLIENT_COMPANY}}': clientData.company || clientData.name,
    '{{CLIENT_PHONE}}': clientData.phone || '',
    '{{TASKFORCE_TYPE}}': taskforceType,
    ...configData
  };

  function replaceInObject(obj) {
    if (typeof obj === 'string') {
      let result = obj;
      Object.entries(substitutions).forEach(([placeholder, value]) => {
        result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || '');
      });
      return result;
    } else if (Array.isArray(obj)) {
      return obj.map(replaceInObject);
    } else if (obj && typeof obj === 'object') {
      const newObj = {};
      Object.entries(obj).forEach(([key, value]) => {
        newObj[key] = replaceInObject(value);
      });
      return newObj;
    }
    return obj;
  }

  return replaceInObject({ ...parameters });
}

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});