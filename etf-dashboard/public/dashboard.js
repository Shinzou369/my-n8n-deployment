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
        currentData.stats = await response.json();
        displayStats();
    } catch (error) {
        console.error('Error loading stats:', error);
        // Fallback to calculated stats
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
            <div class="stat-number">${stats.active_deployments || currentData.deployments.filter(d => d.status === 'deployed').length}</div>
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
        currentData.templates = await response.json();
        displayTemplates();
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

async function loadClients() {
    try {
        const response = await fetch('/api/clients');
        currentData.clients = await response.json();
        displayClients();
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

async function loadDeployments() {
    try {
        const response = await fetch('/api/deployments');
        currentData.deployments = await response.json();
        displayDeployments();
    } catch (error) {
        console.error('Error loading deployments:', error);
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
            <div class="meta">Industry: ${template.industry || 'Not specified'} | Monthly: $${template.monthly_price || 0}</div>
            <p>${template.description || 'No description provided'}</p>
            <p><strong>Required Fields:</strong> ${Array.isArray(template.required_fields) ? template.required_fields.join(', ') : 'None specified'}</p>
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
            <p>📧 ${client.email || 'Email not provided'} | 📞 ${client.phone_number || 'Phone not provided'}</p>
            <p><strong>Business Hours:</strong> ${client.business_hours || 'Not specified'}</p>
            ${client.notes ? `<p><strong>Notes:</strong> ${client.notes}</p>` : ''}
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
            <div class="meta">${deployment.client_company || 'Company not specified'} | ${statusBadge}</div>
            <p><strong>Workflow:</strong> ${deployment.workflow_name || 'Workflow name not set'}</p>
            <p><strong>Revenue:</strong> $${deployment.monthly_revenue || 0}/month</p>
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
        option.textContent = `${template.name} ($${template.monthly_price || 0}/month)`;
        templateSelect.appendChild(option);
    });
}

// Update deployment form based on selected template
function updateDeploymentForm() {
    const templateId = document.getElementById('deployTemplateSelect').value;
    const configFields = document.getElementById('configurationFields');
    const dynamicFields = document.getElementById('dynamicFields');

    if (!templateId) {
        configFields.style.display = 'none';
        return;
    }

    const template = currentData.templates.find(t => t.id == templateId);
    if (!template || !template.config_fields) {
        configFields.style.display = 'none';
        return;
    }

    // Show configuration section
    configFields.style.display = 'block';

    // Create dynamic fields
    dynamicFields.innerHTML = '';
    const configFields = template.config_fields || [];

    configFields.forEach(field => {
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

    const formData = new FormData(e.target);
    const clientData = {
        name: document.getElementById('clientName').value,
        company: document.getElementById('clientCompany').value,
        email: document.getElementById('clientEmail').value,
        phone_number: document.getElementById('clientPhone').value,
        industry: document.getElementById('clientIndustry').value,
        business_hours: document.getElementById('clientHours').value,
        support_email: document.getElementById('clientSupportEmail').value,
        openai_api_key: document.getElementById('clientOpenAIKey').value,
        google_calendar_id: document.getElementById('clientCalendarId').value,
        notes: document.getElementById('clientNotes').value
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
        industry: document.getElementById('templateIndustry').value,
        monthly_price: parseFloat(document.getElementById('templatePrice').value) || 0,
        n8n_template_id: document.getElementById('templateN8NId').value,
        required_fields: document.getElementById('templateFields').value.split(',').map(f => f.trim()).filter(f => f)
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
    const configuration = {};
    const dynamicInputs = document.querySelectorAll('#dynamicFields input');
    dynamicInputs.forEach(input => {
        configuration[input.name] = input.value;
    });

    const deployData = {
        client_id: parseInt(clientId),
        template_id: parseInt(templateId),
        configuration: configuration
    };

    try {
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Deploying...';
        submitBtn.disabled = true;

        const response = await fetch('/api/deploy-workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deployData)
        });

        const result = await response.json();

        if (response.ok) {
            alert(`🎉 Workflow deployed successfully!\n\n${result.message}\n\nDeployment ID: ${result.deployment_id}`);
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
    }
}