let currentStep = 1;
let totalSteps = 6;
let selectedTemplate = null;
let templates = [];
let clientData = {};
let configData = {};

// Initialize the onboarding process
document.addEventListener('DOMContentLoaded', function() {
    loadTemplates();
    updateProgress();
});

async function loadTemplates() {
    try {
        const response = await fetch('/api/active-workflows');
        templates = await response.json();
        
        const selectElement = document.getElementById('templateSelect');
        selectElement.innerHTML = '<option value="">Select a template...</option>';
        
        if (templates.length === 0) {
            selectElement.innerHTML = '<option value="">No active templates available</option>';
            return;
        }
        
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = `${template.name} - ${template.description}`;
            selectElement.appendChild(option);
        });
        
        // Add event listener for template selection
        selectElement.addEventListener('change', onTemplateSelect);
        
    } catch (error) {
        console.error('Error loading templates:', error);
        document.getElementById('templateSelect').innerHTML = '<option value="">Error loading templates</option>';
    }
}

async function onTemplateSelect() {
    const templateId = document.getElementById('templateSelect').value;
    const nextBtn = document.getElementById('nextBtn1');
    
    if (!templateId) {
        nextBtn.disabled = true;
        document.getElementById('templatePreview').style.display = 'none';
        return;
    }
    
    selectedTemplate = templates.find(t => t.id === templateId);
    if (!selectedTemplate) return;
    
    try {
        // Fetch detailed workflow information to analyze required parameters
        const response = await fetch(`/api/workflow-details/${templateId}`);
        const workflowDetails = await response.json();
        
        // Show template preview
        document.getElementById('templateDescription').textContent = selectedTemplate.description;
        
        // Analyze workflow nodes to determine required parameters
        const requiredParams = analyzeWorkflowParameters(workflowDetails);
        displayRequiredParameters(requiredParams);
        
        document.getElementById('templatePreview').style.display = 'block';
        nextBtn.disabled = false;
        
    } catch (error) {
        console.error('Error fetching workflow details:', error);
        // Still allow progression with basic info
        document.getElementById('templateDescription').textContent = selectedTemplate.description;
        document.getElementById('requiredParams').innerHTML = '<p>Template analysis in progress...</p>';
        document.getElementById('templatePreview').style.display = 'block';
        nextBtn.disabled = false;
    }
}

function analyzeWorkflowParameters(workflow) {
    const params = [];
    
    if (!workflow.nodes) return params;
    
    // Common parameter patterns to look for
    const paramPatterns = {
        'Telegram': ['bot_token', 'chat_id'],
        'Gmail': ['email', 'app_password'],
        'OpenAI': ['api_key'],
        'Webhook': ['webhook_url'],
        'HTTP': ['api_endpoint', 'auth_token'],
        'Calendar': ['calendar_id', 'timezone'],
        'Instagram': ['username', 'password'],
        'Database': ['connection_string', 'table_name']
    };
    
    workflow.nodes.forEach(node => {
        const nodeType = node.type;
        const nodeName = node.name;
        
        // Check for common service patterns
        Object.keys(paramPatterns).forEach(service => {
            if (nodeName.toLowerCase().includes(service.toLowerCase()) || 
                nodeType.toLowerCase().includes(service.toLowerCase())) {
                paramPatterns[service].forEach(param => {
                    if (!params.find(p => p.key === param)) {
                        params.push({
                            key: param,
                            label: formatParameterLabel(param),
                            type: getParameterType(param),
                            required: true,
                            service: service
                        });
                    }
                });
            }
        });
        
        // Look for credential requirements in node parameters
        if (node.credentials) {
            Object.keys(node.credentials).forEach(credType => {
                params.push({
                    key: credType.toLowerCase(),
                    label: formatParameterLabel(credType),
                    type: 'password',
                    required: true,
                    service: 'Credentials'
                });
            });
        }
    });
    
    return params;
}

function formatParameterLabel(param) {
    return param.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function getParameterType(param) {
    if (param.includes('email')) return 'email';
    if (param.includes('password') || param.includes('token') || param.includes('key')) return 'password';
    if (param.includes('url')) return 'url';
    if (param.includes('phone')) return 'tel';
    return 'text';
}

function displayRequiredParameters(params) {
    const container = document.getElementById('requiredParams');
    
    if (params.length === 0) {
        container.innerHTML = '<p>No specific parameters required for this template.</p>';
        return;
    }
    
    const html = `
        <h4>Required Configuration:</h4>
        <ul class="parameter-list">
            ${params.map(param => `
                <li>
                    <strong>${param.label}</strong> 
                    <span style="color: #666;">(${param.service})</span>
                    ${param.required ? '<span class="required">*</span>' : ''}
                </li>
            `).join('')}
        </ul>
    `;
    container.innerHTML = html;
    
    // Store parameters for step 3
    selectedTemplate.requiredParams = params;
}

function nextStep() {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    if (currentStep === 4) {
        deployWorkflow();
        return;
    }
    
    if (currentStep < totalSteps) {
        document.getElementById(`step${currentStep}`).classList.remove('active');
        currentStep++;
        document.getElementById(`step${currentStep}`).classList.add('active');
        updateProgress();
        
        if (currentStep === 3) {
            generateDynamicFields();
        } else if (currentStep === 4) {
            generateReviewData();
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        document.getElementById(`step${currentStep}`).classList.remove('active');
        currentStep--;
        document.getElementById(`step${currentStep}`).classList.add('active');
        updateProgress();
    }
}

function updateProgress() {
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    document.getElementById('progressFill').style.width = `${progressPercent}%`;
}

function validateStep1() {
    return selectedTemplate !== null;
}

function validateStep2() {
    const name = document.getElementById('clientName').value.trim();
    const email = document.getElementById('clientEmail').value.trim();
    
    if (!name || !email) {
        alert('Please fill in required fields');
        return false;
    }
    
    clientData = {
        name,
        email,
        industry: document.getElementById('clientIndustry').value.trim()
    };
    
    return true;
}

function validateStep3() {
    const requiredFields = document.querySelectorAll('#dynamicFields input[required], #dynamicFields select[required]');
    
    for (let field of requiredFields) {
        if (!field.value.trim()) {
            alert(`Please fill in: ${field.previousElementSibling.textContent}`);
            field.focus();
            return false;
        }
    }
    
    // Collect configuration data
    configData = {};
    const allFields = document.querySelectorAll('#dynamicFields input, #dynamicFields select, #dynamicFields textarea');
    allFields.forEach(field => {
        configData[field.name] = field.value;
    });
    
    return true;
}

function generateDynamicFields() {
    const container = document.getElementById('dynamicFields');
    const params = selectedTemplate.requiredParams || [];
    
    if (params.length === 0) {
        container.innerHTML = '<p>No additional configuration required for this template.</p>';
        return;
    }
    
    const html = params.map(param => `
        <div class="form-group">
            <label for="${param.key}">${param.label} ${param.required ? '<span class="required">*</span>' : ''}</label>
            <input 
                type="${param.type}" 
                id="${param.key}" 
                name="${param.key}" 
                ${param.required ? 'required' : ''}
                placeholder="Enter your ${param.label.toLowerCase()}"
            >
            <small style="color: #666;">Used by: ${param.service}</small>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function generateReviewData() {
    const reviewContainer = document.getElementById('reviewData');
    
    const html = `
        <h3>📋 Deployment Summary</h3>
        <p><strong>Template:</strong> ${selectedTemplate.name}</p>
        <p><strong>Client:</strong> ${clientData.name} (${clientData.email})</p>
        ${clientData.industry ? `<p><strong>Industry:</strong> ${clientData.industry}</p>` : ''}
        
        <h4>Configuration Parameters:</h4>
        <ul class="parameter-list">
            ${Object.entries(configData).map(([key, value]) => `
                <li>
                    <strong>${formatParameterLabel(key)}:</strong> 
                    ${key.includes('password') || key.includes('token') || key.includes('key') ? 
                        '*'.repeat(Math.min(value.length, 8)) : value}
                </li>
            `).join('')}
        </ul>
        
        <p style="margin-top: 20px; color: #666;">
            <strong>Next:</strong> Your personalized automation workflow will be created and activated.
        </p>
    `;
    
    reviewContainer.innerHTML = html;
}

async function deployWorkflow() {
    // Move to deployment step
    document.getElementById(`step${currentStep}`).classList.remove('active');
    currentStep = 5;
    document.getElementById(`step${currentStep}`).classList.add('active');
    updateProgress();
    
    try {
        const deploymentData = {
            template_id: selectedTemplate.id,
            client_data: clientData,
            config_data: configData
        };
        
        const response = await fetch('/api/deploy-client-workflow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(deploymentData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Success - move to final step
            setTimeout(() => {
                document.getElementById(`step${currentStep}`).classList.remove('active');
                currentStep = 6;
                document.getElementById(`step${currentStep}`).classList.add('active');
                updateProgress();
                
                // Show deployment details
                document.getElementById('deploymentDetails').innerHTML = `
                    <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                        <p><strong>Workflow ID:</strong> ${result.workflow_id}</p>
                        <p><strong>Status:</strong> ${result.status}</p>
                        <p><strong>Client:</strong> ${clientData.name}</p>
                    </div>
                `;
            }, 2000);
        } else {
            throw new Error(result.error || 'Deployment failed');
        }
        
    } catch (error) {
        console.error('Deployment error:', error);
        alert(`Deployment failed: ${error.message}`);
        // Go back to review step
        document.getElementById(`step${currentStep}`).classList.remove('active');
        currentStep = 4;
        document.getElementById(`step${currentStep}`).classList.add('active');
        updateProgress();
    }
}