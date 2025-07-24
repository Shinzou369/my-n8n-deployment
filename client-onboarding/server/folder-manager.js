
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
      
      // Auto-organize all workflows first to ensure proper folder placement
      await this.autoOrganizeAllWorkflows(workflows);
      
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

      // Add any remaining unorganized workflows
      const organizedIds = new Set(this.workflowFolders.keys());
      const unorganized = workflows.filter(w => !organizedIds.has(w.id));
      
      if (unorganized.length > 0) {
        // Try to organize these as well
        for (const workflow of unorganized) {
          const folderPath = this.determineWorkflowFolder(workflow.name);
          this.assignWorkflowToFolder(workflow.id, folderPath);
        }
        
        // Rebuild structure with newly organized workflows
        return this.getFolderStructure();
      }

      return structure;
    } catch (error) {
      console.error('Error getting folder structure:', error);
      throw error;
    }
  }

  // Determine appropriate folder for a workflow based on its name
  determineWorkflowFolder(workflowName) {
    const name = workflowName;
    
    // Check if it's a client workflow (contains " - " in name)
    if (name.includes(' - ')) {
      // Client workflow
      if (name.includes('PET CLINIC')) {
        return 'Clients/Pet Clinic Clients';
      } else if (name.includes('REAL ESTATE')) {
        return 'Clients/Real Estate Clients';
      } else if (name.includes('RESTAURANT')) {
        return 'Clients/Restaurant Clients';
      } else {
        return 'Clients/General Clients';
      }
    } else {
      // Template workflow
      if (name.includes('PET CLINIC')) {
        return 'Templates/Pet Clinic Templates';
      } else if (name.includes('REAL ESTATE')) {
        return 'Templates/Real Estate Templates';
      } else if (name.includes('RESTAURANT')) {
        return 'Templates/Restaurant Templates';
      } else if (name.includes('TEMPLATE') || name === name.toUpperCase()) {
        return 'Templates/General Templates';
      } else if (name.includes('TEST') || name.includes('test')) {
        return 'Templates/Development/Testing';
      } else {
        return 'Templates/Uncategorized';
      }
    }
  }

  // Auto-organize workflows without requiring manual trigger
  async autoOrganizeAllWorkflows(workflows = null) {
    try {
      if (!workflows) {
        const response = await axios.get(`${this.baseUrl}/api/v1/workflows`, {
          headers: { 'X-N8N-API-KEY': this.apiKey }
        });
        workflows = response.data.data;
      }
      
      for (const workflow of workflows) {
        const folderPath = this.determineWorkflowFolder(workflow.name);
        this.assignWorkflowToFolder(workflow.id, folderPath);
      }
      
      return true;
    } catch (error) {
      console.error('Auto-organize failed:', error);
      return false;
    }
  }

  // Auto-organize workflows based on naming convention (public method)
  autoOrganizeWorkflows() {
    return new Promise(async (resolve) => {
      try {
        const success = await this.autoOrganizeAllWorkflows();
        resolve(success);
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
