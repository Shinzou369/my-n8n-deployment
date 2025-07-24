#!/usr/bin/env node

/**
 * N8N Workflow Duplicator Tool
 * Duplicates and personalizes workflows for client deployment
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class N8NWorkflowDuplicator {
    constructor(config) {
        this.baseURL = config.baseURL || process.env.N8N_BASE_URL;
        this.apiKey = config.apiKey || process.env.N8N_API_KEY;
        
        if (!this.baseURL || !this.apiKey) {
            throw new Error('N8N_BASE_URL and N8N_API_KEY must be provided');
        }
        
        this.client = axios.create({
            baseURL: `${this.baseURL}/api/v1`,
            headers: {
                'X-N8N-API-KEY': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
    }

    /**
     * Get all workflows from N8N instance
     */
    async getWorkflows() {
        try {
            const response = await this.client.get('/workflows');
            return response.data.data || [];
        } catch (error) {
            console.error('Error fetching workflows:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get specific workflow by ID
     */
    async getWorkflow(workflowId) {
        try {
            const response = await this.client.get(`/workflows/${workflowId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching workflow ${workflowId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create new workflow
     */
    async createWorkflow(workflowData) {
        try {
            const response = await this.client.post('/workflows', workflowData);
            return response.data;
        } catch (error) {
            console.error('Error creating workflow:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Activate workflow
     */
    async activateWorkflow(workflowId) {
        try {
            const response = await this.client.post(`/workflows/${workflowId}/activate`);
            return response.data;
        } catch (error) {
            console.error(`Error activating workflow ${workflowId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Duplicate workflow with personalization
     */
    async duplicateWorkflow(templateId, clientData, options = {}) {
        try {
            console.log(`🔄 Duplicating workflow ${templateId} for client: ${clientData.name}`);
            
            // 1. Get template workflow
            const template = await this.getWorkflow(templateId);
            console.log(`📋 Retrieved template: ${template.name}`);
            
            // 2. Personalize workflow
            const personalizedWorkflow = this.personalizeWorkflow(template, clientData, options);
            
            // 3. Create new workflow
            const newWorkflow = await this.createWorkflow(personalizedWorkflow);
            console.log(`✅ Created new workflow: ${newWorkflow.name} (ID: ${newWorkflow.id})`);
            
            // 4. Activate if requested
            if (options.activate !== false) {
                await this.activateWorkflow(newWorkflow.id);
                console.log(`🚀 Activated workflow: ${newWorkflow.id}`);
            }
            
            return {
                templateId,
                newWorkflowId: newWorkflow.id,
                workflowName: newWorkflow.name,
                clientName: clientData.name,
                success: true
            };
            
        } catch (error) {
            console.error('❌ Duplication failed:', error.message);
            return {
                templateId,
                clientName: clientData.name,
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Personalize workflow with client data
     */
    personalizeWorkflow(template, clientData, options = {}) {
        // Create a copy of the template
        let workflowData = JSON.parse(JSON.stringify(template));
        
        // Update workflow name first
        const suffix = options.nameSuffix || clientData.name;
        const newName = `${template.name} - ${suffix}`;
        
        // Create clean workflow object with only required properties
        const cleanWorkflow = {
            name: newName,
            nodes: workflowData.nodes || [],
            connections: workflowData.connections || {},
            settings: workflowData.settings || {}
        };
        
        // Add optional properties only if they exist and have content
        if (workflowData.staticData && Object.keys(workflowData.staticData).length > 0) {
            cleanWorkflow.staticData = workflowData.staticData;
        }
        if (workflowData.pinData && Object.keys(workflowData.pinData).length > 0) {
            cleanWorkflow.pinData = workflowData.pinData;
        }
        
        // Personalize nodes if they exist
        if (cleanWorkflow.nodes && cleanWorkflow.nodes.length > 0) {
            cleanWorkflow.nodes = cleanWorkflow.nodes.map(node => this.personalizeNode(node, clientData));
        }
        
        return cleanWorkflow;
    }

    /**
     * Personalize individual node with client data
     */
    personalizeNode(node, clientData) {
        const personalizedNode = JSON.parse(JSON.stringify(node));
        
        // Define substitution mappings
        const substitutions = {
            '{{CLIENT_NAME}}': clientData.name,
            '{{CLIENT_EMAIL}}': clientData.email,
            '{{CLIENT_PHONE}}': clientData.phone,
            '{{CLIENT_COMPANY}}': clientData.company,
            '{{CLIENT_ADDRESS}}': clientData.address,
            '{{CLIENT_WEBSITE}}': clientData.website,
            '{{BUSINESS_NAME}}': clientData.businessName || clientData.name,
            '{{BUSINESS_TYPE}}': clientData.businessType,
            '{{SERVICE_AREA}}': clientData.serviceArea,
            // Add more mappings as needed
            ...clientData.customFields
        };
        
        // Apply substitutions recursively
        personalizedNode.parameters = this.applySubstitutions(personalizedNode.parameters, substitutions);
        
        return personalizedNode;
    }

    /**
     * Apply text substitutions recursively to an object
     */
    applySubstitutions(obj, substitutions) {
        if (typeof obj === 'string') {
            let result = obj;
            Object.entries(substitutions).forEach(([placeholder, value]) => {
                if (value !== undefined && value !== null) {
                    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
                }
            });
            return result;
        } else if (Array.isArray(obj)) {
            return obj.map(item => this.applySubstitutions(item, substitutions));
        } else if (obj && typeof obj === 'object') {
            const result = {};
            Object.entries(obj).forEach(([key, value]) => {
                result[key] = this.applySubstitutions(value, substitutions);
            });
            return result;
        }
        return obj;
    }

    /**
     * List template workflows (those ending with _TEMPLATE)
     */
    async getTemplateWorkflows() {
        const workflows = await this.getWorkflows();
        return workflows.filter(w => 
            w.name.includes('_TEMPLATE') || 
            w.tags?.some(tag => tag.name === 'template')
        );
    }

    /**
     * Export workflow to JSON file
     */
    async exportWorkflow(workflowId, outputPath) {
        try {
            const workflow = await this.getWorkflow(workflowId);
            const filename = `${outputPath}/${workflow.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            
            fs.writeFileSync(filename, JSON.stringify(workflow, null, 2));
            console.log(`📄 Exported workflow to: ${filename}`);
            return filename;
        } catch (error) {
            console.error('Export failed:', error.message);
            throw error;
        }
    }

    /**
     * Import workflow from JSON file
     */
    async importWorkflow(jsonPath, activate = false) {
        try {
            const workflowData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            
            // Remove ID to create new workflow
            delete workflowData.id;
            delete workflowData.versionId;
            
            const newWorkflow = await this.createWorkflow(workflowData);
            console.log(`📥 Imported workflow: ${newWorkflow.name}`);
            
            if (activate) {
                await this.activateWorkflow(newWorkflow.id);
                console.log(`🚀 Activated imported workflow`);
            }
            
            return newWorkflow;
        } catch (error) {
            console.error('Import failed:', error.message);
            throw error;
        }
    }
}

// CLI Usage Example
if (require.main === module) {
    const duplicator = new N8NWorkflowDuplicator({
        baseURL: process.env.N8N_BASE_URL,
        apiKey: process.env.N8N_API_KEY
    });

    // Example client data
    const exampleClient = {
        name: "Downtown Dental",
        email: "contact@downtowndental.com",
        phone: "+1-555-123-4567",
        company: "Downtown Dental Clinic",
        businessType: "Dental Clinic",
        address: "123 Main St, Downtown",
        website: "https://downtowndental.com",
        customFields: {
            '{{APPOINTMENT_BOOKING_URL}}': 'https://downtowndental.com/book',
            '{{OFFICE_HOURS}}': 'Mon-Fri 8AM-6PM'
        }
    };

    async function main() {
        try {
            // List available templates
            console.log('🔍 Finding template workflows...');
            const templates = await duplicator.getTemplateWorkflows();
            
            if (templates.length === 0) {
                console.log('No template workflows found. Create workflows ending with _TEMPLATE first.');
                return;
            }
            
            console.log('Available templates:');
            templates.forEach(t => console.log(`- ${t.name} (ID: ${t.id})`));
            
            // Duplicate the first template
            if (templates.length > 0) {
                const result = await duplicator.duplicateWorkflow(
                    templates[0].id, 
                    exampleClient,
                    { activate: true }
                );
                
                console.log('\n🎉 Duplication Result:', result);
            }
            
        } catch (error) {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        }
    }

    main();
}

module.exports = N8NWorkflowDuplicator;