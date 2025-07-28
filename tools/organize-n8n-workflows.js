
#!/usr/bin/env node

const N8NWorkflowDuplicator = require('./workflow-duplicator');
const N8NFolderManager = require('../client-onboarding/server/folder-manager');

async function organizeAllWorkflows() {
    try {
        console.log('🎯 Starting N8N Workflow Organization...');

        // Initialize tools
        const duplicator = new N8NWorkflowDuplicator({
            baseURL: process.env.N8N_BASE_URL,
            apiKey: process.env.N8N_API_KEY
        });

        const folderManager = new N8NFolderManager(
            process.env.N8N_BASE_URL,
            process.env.N8N_API_KEY
        );

        // Get all workflows
        const workflows = await duplicator.getWorkflows();
        console.log(`📋 Found ${workflows.length} workflows to organize`);

        // Organize each workflow
        for (const workflow of workflows) {
            if (workflow.archived) {
                console.log(`⏭️ Skipping archived workflow: ${workflow.name}`);
                continue;
            }

            // Determine appropriate folder
            const folderPath = folderManager.determineWorkflowFolder(workflow.name);
            
            // Assign to folder (this will update N8N tags)
            await folderManager.assignWorkflowToFolder(workflow.id, folderPath);
            
            console.log(`✅ Organized: ${workflow.name} → ${folderPath}`);
            
            // Small delay to avoid overwhelming N8N API
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('🎉 All workflows have been organized with folder tags!');
        console.log('📱 Check your N8N instance - workflows now have folder tags for easy filtering');

    } catch (error) {
        console.error('❌ Organization failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    organizeAllWorkflows();
}

module.exports = { organizeAllWorkflows };
