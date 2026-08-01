import { describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildIntentMarkdown,
  buildWorkflowFolderManifest,
  exportWorkflowFolder,
  isValidWorkflowId,
  readWorkflowFolder,
  resolveWorkflowFolderRoot,
} from './workflow-folder-service'

describe('workflow-folder service', () => {
  test('validates workflow ids and resolves export roots', () => {
    expect(isValidWorkflowId('demo.folder-smoke')).toBe(true)
    expect(isValidWorkflowId('demo/evil')).toBe(false)
    expect(isValidWorkflowId('..')).toBe(false)

    expect(resolveWorkflowFolderRoot('/tmp/project')).toBe('/tmp/project/workflows')
    expect(resolveWorkflowFolderRoot('/tmp/project/workflows')).toBe('/tmp/project/workflows')
  })

  test('builds manifest and normalizes intent markdown', () => {
    expect(buildIntentMarkdown('  hello\r\nworld  ')).toBe('  hello\nworld')
    expect(buildWorkflowFolderManifest({
      workflowId: 'demo.folder-smoke',
      workflowVersion: 1,
      workflowDescription: '  demo  ',
      exportedAt: '2026-08-02T00:00:00.000Z',
    })).toEqual({
      schema: 'helios/workflow-folder@1',
      exportedAt: '2026-08-02T00:00:00.000Z',
      exportedBy: 'helios-desktop-workflow-studio',
      workflowId: 'demo.folder-smoke',
      workflowVersion: 1,
      workflowDescription: 'demo',
      exportedFiles: ['workflow.yaml', 'INTENT.md', 'manifest.json'],
    })
  })

  test('exports and reads a workflow folder round-trip', async () => {
    const root = join(Bun.env.TMPDIR ?? '/tmp', `helios-folder-${Date.now()}`)
    mkdirSync(root, { recursive: true })
    try {
      const rawYaml = `apiVersion: helios/v1\nkind: Workflow\nid: demo.folder-smoke\nversion: 1\nparams: {}\nsteps:\n  - id: gate\n    uses: approval\n    prompt: "ok?"\n`
      const exported = await exportWorkflowFolder({
        rootPath: root,
        workflowId: 'demo.folder-smoke',
        workflowYaml: rawYaml,
        intentMarkdown: '把线索同步成采购单',
        workflowVersion: 1,
        workflowDescription: 'demo',
      })

      expect(exported.folderPath).toBe(join(root, 'workflows', 'demo.folder-smoke'))
      expect(exported.manifest.workflowId).toBe('demo.folder-smoke')

      const preview = await readWorkflowFolder(exported.folderPath)
      expect(preview.folderName).toBe('demo.folder-smoke')
      expect(preview.workflowYaml).toContain('id: demo.folder-smoke')
      expect(preview.intentMarkdown).toBe('把线索同步成采购单\n')
      expect(preview.manifest?.workflowId).toBe('demo.folder-smoke')
      expect(preview.manifestError).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
