
/**
 * ETF Workflow Duplication API Routes
 * Add these routes to your Express.js server
 */

const ETFWorkflowHandler = require('../core/etf-handler');
const N8NWorkflowDuplicator = require('../core/workflow-duplicator');
const N8NFolderManager = require('../core/folder-manager');

function setupETFRoutes(app) {
    // Initialize components
    const duplicator = new N8NWorkflowDuplicator({
        baseURL: process.env.N8N_BASE_URL,
        apiKey: process.env.N8N_API_KEY
    });
    
    const folderManager = new N8NFolderManager(
        process.env.N8N_BASE_URL,
        process.env.N8N_API_KEY
    );
    
    const etfHandler = new ETFWorkflowHandler(duplicator, folderManager);

    /**
     * ETF Onboarding Endpoint
     * POST /api/onboard-etf
     */
    app.post('/api/onboard-etf', async (req, res) => {
        try {
            const clientData = {
                ...req.body,
                workflowType: 'etf',
                multipleWorkflows: true
            };
            
            console.log('📝 ETF onboarding request received:', clientData.name);
            
            const result = await etfHandler.processETFOnboarding(clientData, {
                activate: true,
                organizeFolders: true
            });
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
            
        } catch (error) {
            console.error('💥 ETF onboarding error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during ETF onboarding',
                type: 'etf'
            });
        }
    });

    /**
     * Get Available ETF Templates
     * GET /api/etf/templates
     */
    app.get('/api/etf/templates', async (req, res) => {
        try {
            const templates = await etfHandler.getAvailableETFTemplates();
            
            res.json({
                success: true,
                templates,
                totalCategories: Object.keys(templates).length,
                totalTemplates: Object.values(templates).reduce((sum, cat) => sum + cat.length, 0)
            });
            
        } catch (error) {
            console.error('Error fetching ETF templates:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch ETF templates'
            });
        }
    });

    /**
     * ETF Status Check
     * GET /api/etf/status/:clientName
     */
    app.get('/api/etf/status/:clientName', async (req, res) => {
        try {
            const { clientName } = req.params;
            const workflows = await duplicator.getWorkflows();
            
            const clientWorkflows = workflows.filter(w => 
                w.name.includes(` - ${clientName}`)
            );
            
            res.json({
                success: true,
                clientName,
                totalWorkflows: clientWorkflows.length,
                activeWorkflows: clientWorkflows.filter(w => w.active).length,
                workflows: clientWorkflows.map(w => ({
                    id: w.id,
                    name: w.name,
                    active: w.active,
                    url: `${process.env.N8N_BASE_URL}/workflow/${w.id}`
                }))
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to check ETF status'
            });
        }
    });

    /**
     * Duplicate Single Workflow (for backwards compatibility)
     * POST /api/duplicate-workflow
     */
    app.post('/api/duplicate-workflow', async (req, res) => {
        try {
            const { templateId, clientData, options = {} } = req.body;
            
            const result = await duplicator.duplicateWorkflow(
                templateId,
                clientData,
                { activate: true, ...options }
            );
            
            res.json(result);
            
        } catch (error) {
            console.error('Single workflow duplication error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to duplicate workflow'
            });
        }
    });

    /**
     * Folder Management Routes
     */
    app.get('/api/folders', async (req, res) => {
        try {
            const folders = await folderManager.getFolderStructure();
            res.json(folders);
        } catch (error) {
            res.status(500).json({ success: false, error: 'Failed to get folders' });
        }
    });

    app.post('/api/workflows/:workflowId/move', async (req, res) => {
        try {
            const { workflowId } = req.params;
            const { folderPath } = req.body;
            
            folderManager.moveWorkflowToFolder(workflowId, folderPath);
            res.json({ success: true, message: `Workflow moved to ${folderPath}` });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Failed to move workflow' });
        }
    });

    /**
     * Health Check
     * GET /api/etf/health
     */
    app.get('/api/etf/health', async (req, res) => {
        try {
            const workflows = await duplicator.getWorkflows();
            
            res.json({
                success: true,
                n8nUrl: process.env.N8N_BASE_URL,
                totalWorkflows: workflows.length,
                systemStatus: 'operational',
                features: ['etf-duplication', 'folder-management', 'auto-organization']
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'N8N connection failed',
                systemStatus: 'error'
            });
        }
    });

    console.log('🔌 ETF Workflow routes initialized');
}

module.exports = { setupETFRoutes };
