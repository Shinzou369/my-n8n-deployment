const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Generate UUID function (simple version)
function generateUUID() {
    return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Import the workflow duplicator
const N8NWorkflowDuplicator = require('../../tools/workflow-duplicator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Initialize N8N Workflow Duplicator
const duplicator = new N8NWorkflowDuplicator({
    baseURL: process.env.N8N_BASE_URL,
    apiKey: process.env.N8N_API_KEY
});

// Your PET CLINIC template workflow ID
const PET_CLINIC_TEMPLATE_ID = 'eC6TieLjDueYJCs9';

// Store client submissions (in production, use a proper database)
let clientSubmissions = [];

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Get available workflow templates
app.get('/api/templates', async (req, res) => {
    try {
        const templates = await duplicator.getTemplateWorkflows();

        // Add your PET CLINIC as a template even if it doesn't end with _TEMPLATE
        const workflows = await duplicator.getWorkflows();
        const petClinicWorkflow = workflows.find(w => w.id === PET_CLINIC_TEMPLATE_ID);

        if (petClinicWorkflow && !templates.find(t => t.id === PET_CLINIC_TEMPLATE_ID)) {
            templates.push({
                ...petClinicWorkflow,
                name: petClinicWorkflow.name + ' (Template)',
                isMainTemplate: true
            });
        }

        res.json({
            success: true,
            templates: templates.map(t => ({
                id: t.id,
                name: t.name,
                description: t.name.includes('PET CLINIC') ? 
                    'Complete pet clinic automation with appointment booking, reminders, and customer service' :
                    'Workflow automation template',
                nodes: t.nodes?.length || 0,
                isMainTemplate: t.isMainTemplate || false
            }))
        });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch workflow templates'
        });
    }
});

// Submit client onboarding form
app.post('/api/onboard', async (req, res) => {
    try {
        const clientData = req.body;
        const submissionId = generateUUID();

        console.log('📝 New client submission received:', clientData.businessName);

        // Validate required fields
        const requiredFields = ['businessName', 'contactEmail', 'phoneNumber'];
        const missingFields = requiredFields.filter(field => !clientData[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Prepare client data for workflow duplication
        const workflowClientData = {
            name: clientData.businessName,
            email: clientData.contactEmail,
            phone: clientData.phoneNumber,
            company: clientData.businessName,
            businessType: clientData.businessType || 'Pet Clinic',
            customFields: {
                '{{CLIENT_BOT_TOKEN}}': clientData.telegramBotToken || '',
                '{{CLIENT_CHAT_ID}}': clientData.telegramChatId || '',
                '{{CLINIC_ADDRESS}}': clientData.businessAddress || '',
                '{{APPOINTMENT_URL}}': clientData.appointmentUrl || '',
                '{{BUSINESS_HOURS}}': clientData.businessHours || 'Mon-Fri 9AM-5PM',
                '{{EMERGENCY_PHONE}}': clientData.emergencyPhone || clientData.phoneNumber,
                '{{WEBSITE_URL}}': clientData.websiteUrl || '',
                '{{SOCIAL_MEDIA}}': clientData.socialMedia || ''
            }
        };

        // Store submission
        const submission = {
            id: submissionId,
            clientData: workflowClientData,
            submittedAt: new Date().toISOString(),
            status: 'processing'
        };

        clientSubmissions.push(submission);

        console.log('🔄 Starting workflow duplication...');

        // Check if this is an ETF (multi-workflow) setup
        const isETFSetup = clientData.workflowType === 'etf' || clientData.multipleWorkflows === true;
        
        let result;
        if (isETFSetup) {
            console.log('🗂️ ETF Setup: Duplicating entire folder of workflows...');
            // Duplicate entire folder for ETF setups
            result = await duplicator.duplicateWorkflowFolder(
                'Business/Pet Clinics', // Folder path
                workflowClientData,
                { activate: true }
            );
        } else {
            console.log('📋 Single workflow duplication...');
            // Single workflow duplication
            result = await duplicator.duplicateWorkflow(
                PET_CLINIC_TEMPLATE_ID,
                workflowClientData,
                { 
                    activate: true,
                    nameSuffix: clientData.businessName
                }
            );
        }

        // Auto-organize workflows after creation to ensure proper folder placement
        if (result.success) {
            try {
                await folderManager.autoOrganizeAllWorkflows();
                console.log('📁 Workflows automatically organized into folders');
            } catch (error) {
                console.log('⚠️ Folder organization warning:', error.message);
            }
        }

        // Update submission status
        submission.status = result.success ? 'completed' : 'failed';
        submission.workflowResult = result;

        if (result.success) {
            if (isETFSetup && result.createdWorkflows) {
                console.log(`✅ ETF Setup completed: ${result.createdWorkflows.length} workflows created`);
                console.log('📋 Created workflows:', result.createdWorkflows.map(w => w.newName).join(', '));

                res.json({
                    success: true,
                    message: `ETF Setup completed! ${result.createdWorkflows.length} workflows created.`,
                    submissionId: submissionId,
                    workflowType: 'etf',
                    createdWorkflows: result.createdWorkflows,
                    summary: result.summary,
                    n8nUrl: process.env.N8N_BASE_URL,
                    firstWorkflowUrl: result.createdWorkflows.length > 0 ? 
                        `${process.env.N8N_BASE_URL}/workflow/${result.createdWorkflows[0].newId}` : null
                });
            } else {
                console.log('✅ Workflow created successfully:', result.workflowName);
                console.log('🆔 New workflow ID:', result.newWorkflowId);

                res.json({
                    success: true,
                    message: 'Workflow created successfully!',
                    submissionId: submissionId,
                    workflowType: 'single',
                    workflowName: result.workflowName,
                    workflowId: result.newWorkflowId,
                    n8nUrl: `${process.env.N8N_BASE_URL}/workflow/${result.newWorkflowId}`
                });
            }
        } else {
            console.log('❌ Workflow creation failed:', result.error);

            res.status(500).json({
                success: false,
                error: result.error || 'Failed to create workflow(s)',
                submissionId: submissionId,
                workflowType: isETFSetup ? 'etf' : 'single'
            });
        }

    } catch (error) {
        console.error('💥 Onboarding error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during onboarding'
        });
    }
});

// Admin endpoint to view all submissions
app.get('/api/admin/submissions', (req, res) => {
    res.json({
        success: true,
        submissions: clientSubmissions.map(s => ({
            id: s.id,
            businessName: s.clientData.name,
            email: s.clientData.email,
            submittedAt: s.submittedAt,
            status: s.status,
            workflowId: s.workflowResult?.newWorkflowId,
            workflowName: s.workflowResult?.workflowName
        }))
    });
});

// Get N8N instance status
app.get('/api/n8n/status', async (req, res) => {
    try {
        const workflows = await duplicator.getWorkflows();
        const activeWorkflows = workflows.filter(w => w.active);

        res.json({
            success: true,
            n8nUrl: process.env.N8N_BASE_URL,
            totalWorkflows: workflows.length,
            activeWorkflows: activeWorkflows.length,
            workflows: workflows.map(w => ({
                id: w.id,
                name: w.name,
                active: w.active,
                nodes: w.nodes?.length || 0,
                createdAt: w.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch N8N status'
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Client Onboarding Server running on port ${PORT}`);
    console.log(`🔗 N8N Instance: ${process.env.N8N_BASE_URL}`);
    console.log(`📋 Template Workflow ID: ${PET_CLINIC_TEMPLATE_ID}`);
});
const N8NFolderManager = require('./folder-manager');

// Initialize folder manager
const folderManager = new N8NFolderManager(
    process.env.N8N_BASE_URL,
    process.env.N8N_API_KEY
);

// Folder management endpoints
app.get('/api/folders', async (req, res) => {
    try {
        const folders = await folderManager.getFolderStructure();
        res.json(folders);
    } catch (error) {
        console.error('Error getting folders:', error);
        res.status(500).json({ success: false, error: 'Failed to get folders' });
    }
});

app.post('/api/folders', async (req, res) => {
    try {
        const { folderPath } = req.body;
        const folder = folderManager.createFolder(folderPath);
        res.json({ success: true, folder });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ success: false, error: 'Failed to create folder' });
    }
});

app.post('/api/workflows/:workflowId/move', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const { folderPath } = req.body;
        
        folderManager.moveWorkflowToFolder(workflowId, folderPath);
        res.json({ success: true, message: `Workflow moved to ${folderPath}` });
    } catch (error) {
        console.error('Error moving workflow:', error);
        res.status(500).json({ success: false, error: 'Failed to move workflow' });
    }
});

app.post('/api/auto-organize', async (req, res) => {
    try {
        const success = await folderManager.autoOrganizeWorkflows();
        res.json({ success, message: success ? 'Auto-organized successfully' : 'Auto-organize failed' });
    } catch (error) {
        console.error('Error auto-organizing:', error);
        res.status(500).json({ success: false, error: 'Failed to auto-organize' });
    }
});

// Delete empty folder
app.delete('/api/folders/:folderPath', async (req, res) => {
    try {
        const folderPath = decodeURIComponent(req.params.folderPath);
        
        const deleted = folderManager.deleteFolder(folderPath);
        
        if (deleted) {
            res.json({ 
                success: true, 
                message: `Folder "${folderPath}" deleted successfully` 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'Folder not found' 
            });
        }
    } catch (error) {
        console.error('Delete folder error:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Reset folder organization
app.post('/api/reset-folders', async (req, res) => {
    try {
        folderManager.resetFolderAssignments();
        res.json({ 
            success: true, 
            message: 'Folder organization reset successfully' 
        });
    } catch (error) {
        console.error('Reset folders error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to reset folder organization' 
        });
    }
});

// Folder view page
app.get('/folders', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/folder-view.html'));
});

// ETF onboarding endpoint (for multiple workflow setups)
app.post('/api/onboard-etf', async (req, res) => {
    try {
        const clientData = { ...req.body, workflowType: 'etf', multipleWorkflows: true };
        
        // Reuse the existing onboard logic but force ETF mode
        req.body = clientData;
        
        // Call the existing onboard handler
        return app._router.handle(req, res);
        
    } catch (error) {
        console.error('ETF onboarding error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process ETF onboarding'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        n8n_url: process.env.N8N_BASE_URL,
        template_id: PET_CLINIC_TEMPLATE_ID,
        features: ['single-workflow', 'etf-multi-workflow', 'drag-drop-folders']
    });
});

// Folder management endpoints
app.get('/api/folders', async (req, res) => {
  try {
    const structure = await folderManager.getFolderStructure();
    res.json(structure);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get folder structure' });
  }
});

app.post('/api/folders', async (req, res) => {
  try {
    const { folderPath } = req.body;
    const folder = folderManager.createFolder(folderPath);
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

app.post('/api/workflows/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { folderPath } = req.body;
    folderManager.assignWorkflowToFolder(id, folderPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to move workflow' });
  }
});

app.post('/api/auto-organize', async (req, res) => {
  try {
    const success = await folderManager.autoOrganizeWorkflows();
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: 'Auto-organize failed' });
  }
});