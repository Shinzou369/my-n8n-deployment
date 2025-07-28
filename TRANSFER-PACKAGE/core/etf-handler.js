
/**
 * ETF (Exchange Traded Fund) Workflow Handler
 * Manages multi-workflow duplication for complex client setups
 */

class ETFWorkflowHandler {
    constructor(duplicator, folderManager) {
        this.duplicator = duplicator;
        this.folderManager = folderManager;
    }

    /**
     * Process ETF onboarding request
     * @param {Object} clientData - Client information
     * @param {Object} options - Duplication options
     * @returns {Object} ETF duplication result
     */
    async processETFOnboarding(clientData, options = {}) {
        console.log(`🗂️ Starting ETF setup for: ${clientData.name}`);
        
        try {
            // Validate ETF request
            this.validateETFRequest(clientData);
            
            // Determine folder path based on business type
            const folderPath = this.determineFolderPath(clientData.businessType);
            
            // Execute multi-workflow duplication
            const result = await this.duplicator.duplicateWorkflowFolder(
                folderPath,
                clientData,
                {
                    activate: options.activate !== false,
                    organizeFolders: true,
                    ...options
                }
            );
            
            // Post-processing
            if (result.success) {
                await this.postProcessETFSetup(result, clientData);
            }
            
            return this.formatETFResponse(result, clientData);
            
        } catch (error) {
            console.error('❌ ETF processing failed:', error);
            return {
                success: false,
                error: error.message,
                clientName: clientData.name,
                type: 'etf'
            };
        }
    }

    /**
     * Validate ETF request data
     */
    validateETFRequest(clientData) {
        const required = ['name', 'email', 'businessType'];
        const missing = required.filter(field => !clientData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields for ETF setup: ${missing.join(', ')}`);
        }
        
        if (!clientData.workflowType || clientData.workflowType !== 'etf') {
            throw new Error('Request must specify workflowType as "etf"');
        }
    }

    /**
     * Determine template folder path based on business type
     */
    determineFolderPath(businessType) {
        const folderMap = {
            'Pet Clinic': 'Templates/Pet-Clinic',
            'Veterinary': 'Templates/Pet-Clinic',
            'Dental Clinic': 'Templates/Dental-Clinic',
            'Medical Practice': 'Templates/Medical-Practice',
            'Restaurant': 'Templates/Restaurant',
            'Real Estate': 'Templates/Real-Estate',
            'E-commerce': 'Templates/E-commerce',
            'Consulting': 'Templates/Consulting'
        };
        
        return folderMap[businessType] || 'Templates/General-Business';
    }

    /**
     * Post-process ETF setup (organize folders, send notifications, etc.)
     */
    async postProcessETFSetup(result, clientData) {
        try {
            // Auto-organize workflows into proper folders
            await this.folderManager.autoOrganizeAllWorkflows();
            
            // Log successful setup
            console.log(`✅ ETF setup completed for ${clientData.name}`);
            console.log(`📊 Created ${result.createdWorkflows.length} workflows`);
            
            // Additional post-processing can go here:
            // - Send welcome email
            // - Create client dashboard
            // - Set up monitoring
            
        } catch (error) {
            console.warn('⚠️ Post-processing warning:', error.message);
            // Don't fail the main process for post-processing errors
        }
    }

    /**
     * Format ETF response for API consumption
     */
    formatETFResponse(result, clientData) {
        if (result.success) {
            return {
                success: true,
                type: 'etf',
                clientName: clientData.name,
                message: `ETF setup completed! ${result.createdWorkflows.length} workflows created.`,
                summary: result.summary,
                createdWorkflows: result.createdWorkflows.map(w => ({
                    id: w.newId,
                    name: w.newName,
                    originalTemplate: w.originalName,
                    active: true,
                    url: `${process.env.N8N_BASE_URL}/workflow/${w.newId}`
                })),
                dashboardUrl: `${process.env.N8N_BASE_URL}/workflows`,
                totalWorkflows: result.createdWorkflows.length,
                errors: result.errors || []
            };
        } else {
            return {
                success: false,
                type: 'etf',
                clientName: clientData.name,
                error: result.error || 'ETF setup failed',
                createdWorkflows: result.createdWorkflows || [],
                errors: result.errors || []
            };
        }
    }

    /**
     * Get ETF templates available for duplication
     */
    async getAvailableETFTemplates() {
        try {
            const allWorkflows = await this.duplicator.getWorkflows();
            
            // Group templates by folder/category
            const templates = {};
            
            for (const workflow of allWorkflows) {
                if (this.isTemplate(workflow)) {
                    const category = this.extractCategory(workflow.name);
                    
                    if (!templates[category]) {
                        templates[category] = [];
                    }
                    
                    templates[category].push({
                        id: workflow.id,
                        name: workflow.name,
                        nodes: workflow.nodes?.length || 0,
                        description: this.generateTemplateDescription(workflow.name)
                    });
                }
            }
            
            return templates;
            
        } catch (error) {
            console.error('Error getting ETF templates:', error);
            return {};
        }
    }

    /**
     * Check if workflow is a template
     */
    isTemplate(workflow) {
        return workflow.name.includes('TEMPLATE') || 
               workflow.name.includes('_TEMPLATE') ||
               workflow.tags?.some(tag => tag.name === 'template') ||
               (!workflow.name.includes(' - ') && workflow.name === workflow.name.toUpperCase());
    }

    /**
     * Extract category from template name
     */
    extractCategory(templateName) {
        if (templateName.includes('PET') || templateName.includes('CLINIC')) return 'Pet Clinic';
        if (templateName.includes('DENTAL')) return 'Dental Clinic';
        if (templateName.includes('RESTAURANT')) return 'Restaurant';
        if (templateName.includes('REAL ESTATE')) return 'Real Estate';
        return 'General Business';
    }

    /**
     * Generate template description
     */
    generateTemplateDescription(templateName) {
        const descriptions = {
            'PET CLINIC': 'Complete pet clinic automation with appointment booking, reminders, and customer service',
            'DENTAL CLINIC': 'Dental practice management with patient follow-ups and appointment scheduling',
            'RESTAURANT': 'Restaurant operations including reservations, orders, and customer feedback',
            'REAL ESTATE': 'Real estate lead management and client communication automation'
        };
        
        for (const [key, desc] of Object.entries(descriptions)) {
            if (templateName.includes(key)) return desc;
        }
        
        return 'Business automation workflow template';
    }
}

module.exports = ETFWorkflowHandler;
