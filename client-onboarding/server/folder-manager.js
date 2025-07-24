
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
    console.log(`📁 Assigned workflow ${workflowId} to folder: ${folderPath}`);
  }

  // Move workflow to a different folder (for UI operations)
  moveWorkflowToFolder(workflowId, targetFolderPath) {
    console.log(`🔄 Moving workflow ${workflowId} to ${targetFolderPath}`);
    this.assignWorkflowToFolder(workflowId, targetFolderPath);
  }

  // Get folder structure with workflows
  async getFolderStructure() {
    try {
      // Get all workflows from n8n
      const response = await axios.get(`${this.baseUrl}/api/v1/workflows`, {
        headers: { 'X-N8N-API-KEY': this.apiKey }
      });
      
      const workflows = response.data.data;
      console.log(`📋 Retrieved ${workflows.length} workflows from N8N`);
      
      // Filter out archived workflows properly
      const activeWorkflows = workflows.filter(workflow => {
        const isArchived = workflow.archived === true || workflow.archived === 'true';
        if (isArchived) {
          console.log(`🗃️ Excluding archived workflow: ${workflow.name}`);
        }
        return !isArchived;
      });
      
      console.log(`✅ Working with ${activeWorkflows.length} non-archived workflows`);
      
      // Build structure from organized workflows
      const structure = {};
      
      // Create default folders if they don't exist
      this.ensureDefaultFolders();
      
      // Only auto-organize workflows that aren't already assigned
      for (const workflow of activeWorkflows) {
        if (!this.workflowFolders.has(workflow.id)) {
          const folderPath = this.determineWorkflowFolder(workflow.name);
          this.assignWorkflowToFolder(workflow.id, folderPath);
        }
      }

      // Build final structure
      for (const [folderPath, folderData] of this.folders) {
        const workflowDetails = [];
        
        for (const workflowId of folderData.workflows) {
          const workflow = activeWorkflows.find(w => w.id === workflowId);
          if (workflow) {
            workflowDetails.push({
              id: workflow.id,
              name: workflow.name,
              active: workflow.active,
              nodes: workflow.nodes?.length || 0,
              archived: false // These are all non-archived
            });
          }
        }
        
        structure[folderPath] = {
          ...folderData,
          workflows: workflowDetails
        };
      }

      return structure;
    } catch (error) {
      console.error('Error getting folder structure:', error);
      throw error;
    }
  }

  // Ensure default folders exist
  ensureDefaultFolders() {
    const defaultFolders = [
      'Templates/Pet Clinic Templates',
      'Templates/Uncategorized',
      'Clients/Pet Clinic Clients',
      'Clients/General Clients'
    ];
    
    for (const folderPath of defaultFolders) {
      if (!this.folders.has(folderPath)) {
        this.createFolder(folderPath);
      }
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
        workflows = response.data.data.filter(w => !w.archived); // Exclude archived
      }
      
      // Reset all assignments first for fresh auto-organization
      for (const workflow of workflows) {
        if (!workflow.archived) { // Double-check archived status
          const folderPath = this.determineWorkflowFolder(workflow.name);
          this.assignWorkflowToFolder(workflow.id, folderPath);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Auto-organize failed:', error);
      return false;
    }
  }

  // Reset all folder assignments
  resetFolderAssignments() {
    this.workflowFolders.clear();
    for (const folder of this.folders.values()) {
      folder.workflows = [];
    }
    console.log('🔄 All folder assignments reset');
  }

  // Delete empty folder
  deleteFolder(folderPath) {
    if (this.folders.has(folderPath)) {
      const folderData = this.folders.get(folderPath);
      
      // Only allow deletion if folder is empty
      if (folderData.workflows.length === 0) {
        this.folders.delete(folderPath);
        
        // Remove workflow mappings for this folder
        for (const [workflowId, path] of this.workflowFolders.entries()) {
          if (path === folderPath) {
            this.workflowFolders.delete(workflowId);
          }
        }
        
        return true;
      } else {
        throw new Error('Cannot delete folder with workflows. Move workflows first.');
      }
    }
    return false;
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
