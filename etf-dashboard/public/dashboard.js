
let currentData = {
    templates: [],
    clients: [],
    deployments: [],
    stats: {}
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
    setupEventListeners();
});

function setupEventListeners() {
    // Form submissions
    document.getElementById('clientForm').addEventListener('submit', handleClientSubmit);
    document.getElementById('templateForm').addEventListener('submit', handleTemplateSubmit);
    document.getElementById('deployForm').addEventListener('submit', handleDeploySubmit);

    // Dynamic deployment form
    document.getElementById('deployTemplateSelect').addEventListener('change', updateDeploymentForm);
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';

    // Populate select dropdowns when opening deploy modal
    if (modalId === 'deployModal') {
        populateDeploySelects();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';

    // Reset forms when closing
    if (modalId === 'clientModal') document.getElementById('clientForm').reset();
    if (modalId === 'templateModal') document.getElementById('templateForm').reset();
    if (modalId === 'deployModal') {
        document.getElementById('deployForm').reset();
        document.getElementById('configurationFields').style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

async function loadAllData() {
    await Promise.all([
        loadStats(),
        loadTemplates(),
        loadClients(),
        loadDeployments()
    ]);
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        if (response.ok) {
            currentData.stats = await response.json();
        } else {
            // Fallback to default stats
            currentData.stats = {
                total_clients: 0,
                total_templates: 0,
                active_deployments: 0,
                monthly_revenue: 0
            };
        }
        displayStats();
    } catch (error) {
        console.error('Error loading stats:', error);
        // Fallback to calculated stats
        currentData.stats = {
            total_clients: currentData.clients.length,
            total_templates: currentData.templates.length,
            active_deployments: currentData.deployments.filter(d => d.status === 'active').length,
            monthly_revenue: 0
        };
        displayStats();
    }
}

function displayStats() {
    const stats = currentData.stats;
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-number">${stats.total_clients || currentData.clients.length}</div>
            <div class="stat-label">Total Clients</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.total_templates || currentData.templates.length}</div>
            <div class="stat-label">ETF Templates</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.active_deployments || currentData.deployments.filter(d => d.status === 'active').length}</div>
            <div class="stat-label">Active Deployments</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$${(stats.monthly_revenue || 0).toFixed(0)}</div>
            <div class="stat-label">Monthly Revenue</div>
        </div>
    `;
    document.getElementById('statsContainer').innerHTML = statsHtml;
}

async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        if (response.ok) {
            currentData.templates = await response.json();
        } else {
            currentData.templates = [];
        }
        displayTemplates();
    } catch (error) {
        console.error('Error loading templates:', error);
        currentData.templates = [];
        displayTemplates();
    }
}

async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        if (response.ok) {
            currentData.clients = await response.json();
        } else {
            currentData.clients = [];
        }
        displayClients();
    } catch (error) {
        console.error('Error loading clients:', error);
        currentData.clients = [];
        displayClients();
    }
}

async function loadDeployments() {
    try {
        const response = await fetch('/api/deployments');
        if (response.ok) {
            currentData.deployments = await response.json();
        } else {
            currentData.deployments = [];
        }
        displayDeployments();
    } catch (error) {
        console.error('Error loading deployments:', error);
        currentData.deployments = [];
        displayDeployments();
    }
}

function displayTemplates() {
    const container = document.getElementById('templatesList');
    container.innerHTML = '';

    if (currentData.templates.length === 0) {
        container.innerHTML = '<div class="list-item"><p>No templates yet. Create your first ETF template!</p></div>';
        return;
    }

    currentData.templates.forEach(template => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <h3>💼 ${template.name}</h3>
            <div class="meta">Category: ${template.category || 'Not specified'}</div>
            <p>${template.description || 'No description provided'}</p>
            <p><strong>N8N Workflow ID:</strong> ${template.n8n_workflow_id || 'Not set'}</p>
            <p><strong>Config Fields:</strong> ${Array.isArray(template.config_fields) ? template.config_fields.length : 0} fields</p>
            <small>Created: ${new Date(template.created_at).toLocaleDateString()}</small>
        `;
        container.appendChild(div);
    });
}

function displayClients() {
    const container = document.getElementById('clientsList');
    container.innerHTML = '';

    if (currentData.clients.length === 0) {
        container.innerHTML = '<div class="list-item"><p>No clients yet. Add your first client to get started!</p></div>';
        return;
    }

    currentData.clients.forEach(client => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <h3>👤 ${client.name}</h3>
            <div class="meta">${client.company || 'No company'} | ${client.industry || 'Industry not specified'}</div>
            <p>📧 ${client.email || 'Email not provided'}</p>
            <small>Added: ${new Date(client.created_at).toLocaleDateString()}</small>
        `;
        container.appendChild(div);
    });
}

function displayDeployments() {
    const container = document.getElementById('deploymentsList');
    container.innerHTML = '';

    if (currentData.deployments.length === 0) {
        container.innerHTML = '<div class="list-item"><p>No deployments yet. Deploy your first workflow!</p></div>';
        return;
    }

    currentData.deployments.forEach(deployment => {
        const div = document.createElement('div');
        div.className = 'list-item deployment-card';
        const statusBadge = `<span class="status-badge status-${deployment.status}">${deployment.status}</span>`;

        div.innerHTML = `
            <h3>⚡ ${deployment.client_name} - ${deployment.template_name}</h3>
            <div class="meta">${statusBadge}</div>
            <p><strong>Workflow:</strong> ${deployment.workflow_name || 'Workflow name not set'}</p>
            ${deployment.n8n_workflow_id ? `<p><strong>N8N ID:</strong> ${deployment.n8n_workflow_id}</p>` : ''}
            <small>Deployed: ${new Date(deployment.deployed_at).toLocaleDateString()}</small>
        `;
        container.appendChild(div);
    });
}

// Populate deploy modal selects
function populateDeploySelects() {
    const clientSelect = document.getElementById('deployClientSelect');
    const templateSelect = document.getElementById('deployTemplateSelect');

    // Clear existing options
    clientSelect.innerHTML = '<option value="">Choose a client...</option>';
    templateSelect.innerHTML = '<option value="">Choose a template...</option>';

    // Populate clients
    currentData.clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = `${client.name} - ${client.company || 'No company'}`;
        clientSelect.appendChild(option);
    });

    // Populate templates
    currentData.templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        templateSelect.appendChild(option);
    });
}

// Update deployment form based on selected template
function updateDeploymentForm() {
    const templateId = document.getElementById('deployTemplateSelect').value;
    const configFieldsDiv = document.getElementById('configurationFields');
    const dynamicFields = document.getElementById('dynamicFields');

    if (!templateId) {
        configFieldsDiv.style.display = 'none';
        return;
    }

    const template = currentData.templates.find(t => t.id == templateId);
    if (!template || !template.config_fields) {
        configFieldsDiv.style.display = 'none';
        return;
    }

    // Show configuration section
    configFieldsDiv.style.display = 'block';

    // Create dynamic fields
    dynamicFields.innerHTML = '';
    const templateConfigFields = template.config_fields || [];

    templateConfigFields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'form-group';

        const fieldName = typeof field === 'string' ? field : field.name;
        const fieldType = typeof field === 'string' ? 
            (field.includes('email') ? 'email' : field.includes('key') ? 'password' : 'text') :
            (field.type || 'text');
        const fieldLabel = typeof field === 'string' ? 
            field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) :
            (field.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

        div.innerHTML = `
            <label>${fieldLabel}:</label>
            <input type="${fieldType}" name="${fieldName}" placeholder="Enter ${fieldLabel.toLowerCase()}...">
        `;
        dynamicFields.appendChild(div);
    });
}

// Form submission handlers
async function handleClientSubmit(e) {
    e.preventDefault();

    const clientData = {
        name: document.getElementById('clientName').value,
        company: document.getElementById('clientCompany').value,
        email: document.getElementById('clientEmail').value,
        industry: document.getElementById('clientIndustry').value
    };

    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });

        if (response.ok) {
            alert('✅ Client added successfully!');
            closeModal('clientModal');
            loadClients();
            loadStats();
        } else {
            alert('❌ Error adding client');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error adding client');
    }
}

async function handleTemplateSubmit(e) {
    e.preventDefault();

    const templateData = {
        name: document.getElementById('templateName').value,
        description: document.getElementById('templateDescription').value,
        category: document.getElementById('templateIndustry').value,
        n8n_workflow_id: document.getElementById('templateN8NId').value,
        config_fields: document.getElementById('templateFields').value.split(',').map(f => f.trim()).filter(f => f)
    };

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData)
        });

        if (response.ok) {
            alert('✅ Template added successfully!');
            closeModal('templateModal');
            loadTemplates();
            loadStats();
        } else {
            alert('❌ Error adding template');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error adding template');
    }
}

// The main deployment function - this is the core feature!
async function handleDeploySubmit(e) {
    e.preventDefault();

    const clientId = document.getElementById('deployClientSelect').value;
    const templateId = document.getElementById('deployTemplateSelect').value;

    if (!clientId || !templateId) {
        alert('❌ Please select both client and template');
        return;
    }

    // Collect configuration data from dynamic fields
    const config_data = {};
    const dynamicInputs = document.querySelectorAll('#dynamicFields input');
    dynamicInputs.forEach(input => {
        config_data[input.name] = input.value;
    });

    const deployData = {
        client_id: clientId,
        template_id: templateId,
        config_data: config_data
    };

    try {
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Deploying...';
        submitBtn.disabled = true;

        const response = await fetch('/api/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deployData)
        });

        const result = await response.json();

        if (response.ok) {
            alert(`🎉 Workflow deployed successfully!\n\n${result.message}`);
            closeModal('deployModal');
            loadDeployments();
            loadStats();
        } else {
            alert(`❌ Deployment failed: ${result.error}`);
        }

        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error during deployment');
        // Reset button on error
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.textContent = '🚀 Deploy Workflow';
        submitBtn.disabled = false;
    }
}
