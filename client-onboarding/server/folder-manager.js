
const axios = require('axios');

class N8NFolderManager {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.folders = new Map(); // In-memory folder structure
    this.workflowFolders = new Map(); // workflow_id -> folder_path
  }

  // Create a virtual folder structure
  createFolder(folderPath) {
    const parts = folderPath.split('/');
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!this.folders.has(currentPath)) {
        this.folders.set(currentPath, {
          name: part,
          path: currentPath,
          workflows: [],
          subfolders: [],
          created: new Date().toISOString()
        });
      }
    }
    
    return this.folders.get(folderPath);
  }

  // Assign workflow to folder
  assignWorkflowToFolder(workflowId, folderPath) {
    // Create folder if it doesn't exist
    this.createFolder(folderPath);
    
    // Remove from old folder if exists
    const oldFolder = this.workflowFolders.get(workflowId);
    if (oldFolder && this.folders.has(oldFolder)) {
      const folder = this.folders.get(oldFolder);
      folder.workflows = folder.workflows.filter(id => id !== workflowId);
    }
    
    // Add to new folder
    const folder = this.folders.get(folderPath);
    if (!folder.workflows.includes(workflowId)) {
      folder.workflows.push(workflowId);
    }
    
    this.workflowFolders.set(workflowId, folderPath);
  }

  // Get folder structure with workflows
  async getFolderStructure() {
    try {
      // Get all workflows from n8n
      const response = await axios.get(`${this.baseUrl}/api/v1/workflows`, {
        headers: { 'X-N8N-API-KEY': this.apiKey }
      });
      
      const workflows = response.data.data;
      const structure = {};

      // Organize workflows by folder
      for (const [folderPath, folderData] of this.folders) {
        const workflowDetails = [];
        
        for (const workflowId of folderData.workflows) {
          const workflow = workflows.find(w => w.id === workflowId);
          if (workflow) {
            workflowDetails.push({
              id: workflow.id,
              name: workflow.name,
              active: workflow.active,
              nodes: workflow.nodes?.length || 0
            });
          }
        }
        
        structure[folderPath] = {
          ...folderData,
          workflows: workflowDetails
        };
      }

      // Add unorganized workflows to "Uncategorized" folder
      const organizedIds = new Set(this.workflowFolders.keys());
      const unorganized = workflows.filter(w => !organizedIds.has(w.id));
      
      if (unorganized.length > 0) {
        structure['Uncategorized'] = {
          name: 'Uncategorized',
          path: 'Uncategorized',
          workflows: unorganized.map(w => ({
            id: w.id,
            name: w.name,
            active: w.active,
            nodes: w.nodes?.length || 0
          })),
          subfolders: [],
          created: new Date().toISOString()
        };
      }

      return structure;
    } catch (error) {
      console.error('Error getting folder structure:', error);
      throw error;
    }
  }

  // Auto-organize workflows based on naming convention
  autoOrganizeWorkflows() {
    return new Promise(async (resolve) => {
      try {
        const response = await axios.get(`${this.baseUrl}/api/v1/workflows`, {
          headers: { 'X-N8N-API-KEY': this.apiKey }
        });
        
        const workflows = response.data.data;
        
        for (const workflow of workflows) {
          const name = workflow.name;
          let folderPath = 'Uncategorized';
          
          // Auto-organize based on naming patterns
          if (name.includes('PET CLINIC')) {
            folderPath = 'Business/Pet Clinics';
          } else if (name.includes('REAL ESTATE')) {
            folderPath = 'Business/Real Estate';
          } else if (name.includes('RESTAURANT')) {
            folderPath = 'Business/Restaurants';
          } else if (name.includes('TEMPLATE') || name === name.toUpperCase()) {
            folderPath = 'Templates';
          } else if (name.includes('TEST') || name.includes('test')) {
            folderPath = 'Development/Testing';
          }
          
          this.assignWorkflowToFolder(workflow.id, folderPath);
        }
        
        resolve(true);
      } catch (error) {
        console.error('Auto-organize failed:', error);
        resolve(false);
      }
    });
  }

  // Create workflow in specific folder
  async createWorkflowInFolder(workflowData, folderPath) {
    try {
      // Create workflow in n8n
      const response = await axios.post(`${this.baseUrl}/api/v1/workflows`, workflowData, {
        headers: { 'X-N8N-API-KEY': this.apiKey }
      });
      
      const newWorkflow = response.data;
      
      // Assign to folder
      this.assignWorkflowToFolder(newWorkflow.id, folderPath);
      
      return newWorkflow;
    } catch (error) {
      console.error('Error creating workflow in folder:', error);
      throw error;
    }
  }
}

module.exports = N8NFolderManager;
