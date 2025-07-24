#!/usr/bin/env node

/**
 * Demo: Duplicating PET CLINIC workflow for 3 new clients
 */

const N8NWorkflowDuplicator = require('./workflow-duplicator');

// Your actual PET CLINIC workflow ID
const PET_CLINIC_TEMPLATE_ID = 'eC6TieLjDueYJCs9';

const duplicator = new N8NWorkflowDuplicator({
    baseURL: process.env.N8N_BASE_URL,
    apiKey: process.env.N8N_API_KEY
});

// Three new pet clinic clients
const newClients = [
    {
        name: "Downtown Veterinary",
        email: "appointments@downtownvets.com", 
        phone: "+1-555-DOWNTOWN",
        company: "Downtown Veterinary Clinic",
        businessType: "Veterinary Clinic",
        customFields: {
            '{{CLIENT_BOT_TOKEN}}': "1234567890:AAEhBOweik9rDKd9oNEbLkd2J3hL",
            '{{CLIENT_CHAT_ID}}': "@downtownvets",
            '{{CLINIC_ADDRESS}}': "123 Main St, Downtown",
            '{{APPOINTMENT_URL}}': "https://book.downtownvets.com"
        }
    },
    {
        name: "Westside Animal Hospital",
        email: "contact@westsideah.com",
        phone: "+1-555-WESTSIDE", 
        company: "Westside Animal Hospital LLC",
        businessType: "Animal Hospital",
        customFields: {
            '{{CLIENT_BOT_TOKEN}}': "9876543210:BBFgCPxfjk8sDLe0pOFcMle3K4iMie3K4i",
            '{{CLIENT_CHAT_ID}}': "@westsideah",
            '{{CLINIC_ADDRESS}}': "456 West Ave, Westside",
            '{{APPOINTMENT_URL}}': "https://schedule.westsideah.com"
        }
    },
    {
        name: "Happy Paws Clinic", 
        email: "hello@happypaws.vet",
        phone: "+1-555-HAPPYPAWS",
        company: "Happy Paws Veterinary Services",
        businessType: "Veterinary Services",
        customFields: {
            '{{CLIENT_BOT_TOKEN}}': "5555555555:CCGhDQyglj9tEMf1qPGdNmf4L5jNjf4L5j",
            '{{CLIENT_CHAT_ID}}': "@happypaws",
            '{{CLINIC_ADDRESS}}': "789 Pet Lane, Suburbs",
            '{{APPOINTMENT_URL}}': "https://happypaws.vet/book"
        }
    }
];

async function deployForAllClients() {
    console.log('🚀 Starting bulk deployment for 3 new pet clinics...\n');
    
    const results = [];
    
    for (const client of newClients) {
        console.log(`⏳ Deploying for ${client.name}...`);
        
        try {
            const result = await duplicator.duplicateWorkflow(
                PET_CLINIC_TEMPLATE_ID,
                client,
                { 
                    activate: true,
                    nameSuffix: client.name 
                }
            );
            
            results.push(result);
            
            if (result.success) {
                console.log(`✅ Success! Created workflow: ${result.workflowName}`);
                console.log(`   New workflow ID: ${result.newWorkflowId}`);
            } else {
                console.log(`❌ Failed: ${result.error}`);
            }
            
        } catch (error) {
            console.log(`❌ Error deploying for ${client.name}: ${error.message}`);
            results.push({
                clientName: client.name,
                success: false,
                error: error.message
            });
        }
        
        console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('📊 DEPLOYMENT SUMMARY');
    console.log('====================');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total workflows in N8N: ${3 + successful} (original + new)`);
    
    if (successful > 0) {
        console.log('\n🎉 New workflows created:');
        results.filter(r => r.success).forEach(r => {
            console.log(`- ${r.workflowName} (ID: ${r.newWorkflowId})`);
        });
    }
    
    return results;
}

// Run the deployment
if (require.main === module) {
    deployForAllClients()
        .then(results => {
            console.log('\n🏁 Deployment complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Deployment failed:', error.message);
            process.exit(1);
        });
}

module.exports = { deployForAllClients, newClients };