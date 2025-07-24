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
        
        // Duplicate the workflow
        const result = await duplicator.duplicateWorkflow(
            PET_CLINIC_TEMPLATE_ID,
            workflowClientData,
            { 
                activate: true,
                nameSuffix: clientData.businessName
            }
        );
        
        // Update submission status
        submission.status = result.success ? 'completed' : 'failed';
        submission.workflowResult = result;
        
        if (result.success) {
            console.log('✅ Workflow created successfully:', result.workflowName);
            console.log('🆔 New workflow ID:', result.newWorkflowId);
            
            res.json({
                success: true,
                message: 'Workflow created successfully!',
                submissionId: submissionId,
                workflowName: result.workflowName,
                workflowId: result.newWorkflowId,
                n8nUrl: `${process.env.N8N_BASE_URL}/workflow/${result.newWorkflowId}`
            });
        } else {
            console.log('❌ Workflow creation failed:', result.error);
            
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to create workflow',
                submissionId: submissionId
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