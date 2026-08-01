export interface WorkflowFolderManifest {
  schema: 'helios/workflow-folder@1'
  exportedAt: string
  exportedBy: 'helios-desktop-workflow-studio'
  workflowId: string
  workflowVersion: number
  workflowDescription?: string
  exportedFiles: string[]
}

export interface WorkflowFolderImportPreview {
  folderPath: string
  folderName: string
  workflowYamlPath: string
  workflowYaml: string
  intentMdPath: string
  intentMarkdown: string | null
  promptMdPath: string
  promptMarkdown: string | null
  readmePath: string
  readmeMarkdown: string | null
  manifestPath: string
  manifest: WorkflowFolderManifest | null
  manifestError: string | null
}

export interface WorkflowFolderExportRequest {
  rootPath: string
  workflowId: string
  workflowYaml: string
  intentMarkdown: string
  workflowVersion: number
  workflowDescription?: string
}

export interface WorkflowFolderExportResult {
  folderPath: string
  folderName: string
  workflowYamlPath: string
  intentMdPath: string
  manifestPath: string
  manifest: WorkflowFolderManifest
}
