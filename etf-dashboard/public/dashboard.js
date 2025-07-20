// ETF Dashboard JavaScript
let templates = [];
let clients = [];
let deployments = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkN8NConnection();
    loadAllData();
    setupFormHandlers();
});

// Check N8N connection status
async function checkN8NConnection() {
    try {
        const response = await fetch('/api/test-n8n');
        const result = await response.json();
        
        const statusElement = document.getElementById('connectionStatus');
        const iconElement = document.getElementById('statusIcon');
        const textElement = document.getElementById('statusText');
        
        if (result.success) {
            statusElement.className = 'connection-status status-connected';
            iconElement.textContent = '🟢';
            textElement.textContent = `Connected to N8N (${result.workflow_count} workflows available)`;
        } else {
            statusElement.className = 'connection-status status-disconnected';
            iconElement.textContent = '🔴';
            textElement.textContent = result.details || 'N8N connection failed - Configure in settings';
        }
    } catch (error) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.className = 'connection-status status-disconnected';
        document.getElementById('statusIcon').textContent = '🔴';
        document.getElementById('statusText').textContent = 'Dashboard connection error';
    }
}

// Load all data for dashboard
async function loadAllData() {
    try {
        // Load templates
        const templatesResponse = await fetch('/api/templates');
        templates = await templatesResponse.json();
        updateStats('templateCount', templates.length);
        populateTemplateSelect();
        
        // Load clients
        const clientsResponse = await fetch('/api/clients');
        clients = await clientsResponse.json();
        updateStats('clientCount', clients.length);
        populateClientSelect();
        
        // Load deployments
        const deploymentsResponse = await fetch('/api/deployments');
        deployments = await deploymentsResponse.json();
        updateStats('deploymentCount', deployments.filter(d => d.status === 'active').length);
        displayDeployments();
        
        // Calculate estimated revenue (placeholder calculation)
        const revenue = deployments.filter(d => d.status === 'active').length * 50; // $50 per active deployment
        updateStats('revenueCount', `$${revenue}`);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Update dashboard statistics
function updateStats(elementId, value) {
    document.getElementById(elementId).textContent = value;
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Populate client select dropdown
function populateClientSelect() {
    const select = document.getElementById('clientSelect');
    select.innerHTML = '<option value="">Choose a client...</option>';
    
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = `${client.name} (${client.company || 'No company'})`;
        select.appendChild(option);
    });
}

// Populate template select dropdown
function populateTemplateSelect() {
    const select = document.getElementById('templateSelect');
    select.innerHTML = '<option value="">Choose a template...</option>';
    
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = `${template.name} (${template.category || 'No category'})`;
        select.appendChild(option);
    });
}

// Handle template selection change (show configuration fields)
function onTemplateSelectionChange() {
    const templateSelect = document.getElementById('templateSelect');
    const configFields = document.getElementById('configFields');
    const selectedTemplateId = templateSelect.value;
    
    if (!selectedTemplateId) {
        configFields.innerHTML = '';
        return;
    }
    
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate || !selectedTemplate.config_fields) {
        configFields.innerHTML = '<p>No configuration fields defined for this template.</p>';
        return;
    }
    
    // Generate form fields based on template configuration
    let fieldsHtml = '<h3>Configuration Fields:</h3>';
    selectedTemplate.config_fields.forEach(field => {
        fieldsHtml += `
            <div class="form-group">
                <label for="config_${field.name}">${field.label}:</label>
                <input 
                    type="${field.type || 'text'}" 
                    id="config_${field.name}" 
                    name="${field.name}"
                    placeholder="${field.placeholder || ''}"
                    ${field.required ? 'required' : ''}
                >
                ${field.description ? `<small style="color: #666;">${field.description}</small>` : ''}
            </div>
        `;
    });
    
    configFields.innerHTML = fieldsHtml;
}

// Display deployments list
function displayDeployments() {
    const deploymentsList = document.getElementById('deploymentsList');
    
    if (deployments.length === 0) {
        deploymentsList.innerHTML = `
            <div class="deployment-item">
                <div class="deployment-info">
                    <h4>No deployments yet</h4>
                    <p>Deploy your first workflow to see it here</p>
                </div>
            </div>
        `;
        return;
    }
    
    deploymentsList.innerHTML = deployments.map(deployment => `
        <div class="deployment-item">
            <div class="deployment-info">
                <h4>${deployment.workflow_name}</h4>
                <p>${deployment.client_name} • ${new Date(deployment.deployed_at).toLocaleDateString()}</p>
            </div>
            <span class="status-badge status-${deployment.status}">${deployment.status}</span>
        </div>
    `).join('');
}

// Setup form handlers
function setupFormHandlers() {
    // Template selection change
    document.getElementById('templateSelect').addEventListener('change', onTemplateSelectionChange);
    
    // Deploy form
    document.getElementById('deployForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const clientId = formData.get('clientSelect');
        const templateId = formData.get('templateSelect');
        
        // Collect configuration data
        const configData = {};
        const configInputs = document.querySelectorAll('#configFields input');
        configInputs.forEach(input => {
            if (input.name && input.value) {
                configData[input.name] = input.value;
            }
        });
        
        try {
            const response = await fetch('/api/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_id: clientId,
                    template_id: templateId,
                    config_data: configData
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`Workflow deployed successfully!\nWorkflow: ${result.workflow_name}`);
                closeModal('deployModal');
                loadAllData(); // Refresh data
                e.target.reset();
                document.getElementById('configFields').innerHTML = '';
            } else {
                alert(`Deployment failed: ${result.error}\n${result.details || ''}`);
            }
        } catch (error) {
            alert(`Deployment error: ${error.message}`);
        }
    });
    
    // Template form
    document.getElementById('templateForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const templateData = {
            name: formData.get('templateName'),
            description: formData.get('templateDescription'),
            category: formData.get('templateCategory'),
            n8n_workflow_id: formData.get('n8nWorkflowId'),
            config_fields: [] // TODO: Add dynamic config field builder
        };
        
        try {
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(templateData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Template added successfully!');
                closeModal('templateModal');
                loadAllData(); // Refresh data
                e.target.reset();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });
    
    // Client form
    document.getElementById('clientForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const clientData = {
            name: formData.get('clientName'),
            email: formData.get('clientEmail'),
            company: formData.get('clientCompany'),
            industry: formData.get('clientIndustry')
        };
        
        try {
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Client added successfully!');
                closeModal('clientModal');
                loadAllData(); // Refresh data
                e.target.reset();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });
    
    // Settings form
    document.getElementById('settingsForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const settingsData = {
            baseURL: formData.get('n8nUrl'),
            username: formData.get('n8nUsername'),
            password: formData.get('n8nPassword')
        };
        
        try {
            const response = await fetch('/api/settings/n8n', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settingsData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('N8N settings updated successfully!');
                closeModal('settingsModal');
                checkN8NConnection(); // Recheck connection
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });
}

// Test N8N connection
async function testConnection() {
    // Update settings first
    const formData = new FormData(document.getElementById('settingsForm'));
    const settingsData = {
        baseURL: formData.get('n8nUrl'),
        username: formData.get('n8nUsername'),
        password: formData.get('n8nPassword')
    };
    
    try {
        // Update settings
        await fetch('/api/settings/n8n', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settingsData)
        });
        
        // Test connection
        const response = await fetch('/api/test-n8n');
        const result = await response.json();
        
        if (result.success) {
            alert(`Connection successful!\nFound ${result.workflow_count} workflows in your N8N instance.`);
        } else {
            alert(`Connection failed: ${result.details}`);
        }
        
        checkN8NConnection(); // Update UI status
        
    } catch (error) {
        alert(`Connection test error: ${error.message}`);
    }
}