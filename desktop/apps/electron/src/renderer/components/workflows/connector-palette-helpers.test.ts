import { describe, expect, test } from 'bun:test'
import type { RegisteredCLI } from '@/lib/helios/types'
import {
  buildConnectorInsertText,
  countConnectorCommands,
  filterConnectorCatalog,
  formatConnectorArg,
  formatConnectorCommandPath,
  formatConnectorSideEffect,
  insertTextAtSelection,
  normalizeConnectorQuery,
} from './connector-palette-helpers'

const inventoryCli: RegisteredCLI = {
  name: 'demo-inventory',
  version: '0.1.0',
  path: '/tmp/demo-inventory',
  introspect: {
    name: 'demo-inventory',
    version: '0.1.0',
    commands: [
      {
        path: ['items', 'create'],
        sideEffect: 'write',
        dryRun: true,
        args: [
          { name: '--from-json', type: 'json', required: true },
          { name: '--output', type: 'string', enum: ['json'], default: 'json' },
        ],
      },
      {
        path: ['items', 'list'],
        sideEffect: 'read',
      },
    ],
  },
}

describe('connector palette helpers', () => {
  test('normalizes connector queries and formats commands', () => {
    expect(normalizeConnectorQuery('  GitHub  MCP ')).toBe('github  mcp')
    expect(formatConnectorCommandPath(inventoryCli.introspect.commands[0]!)).toBe('items create')
    expect(formatConnectorSideEffect('write')).toBe('write')
  })

  test('formats connector args for display', () => {
    expect(formatConnectorArg(inventoryCli.introspect.commands[0]!.args![0]!)).toBe('--from-json · 必填')
    expect(formatConnectorArg(inventoryCli.introspect.commands[0]!.args![1]!)).toBe('--output · 可选: json · 默认: json')
  })

  test('builds insert text with command summary and dry-run hint', () => {
    expect(buildConnectorInsertText(inventoryCli, inventoryCli.introspect.commands[0]!)).toContain('请优先使用连接器 `demo-inventory items create`（write）。')
    expect(buildConnectorInsertText(inventoryCli, inventoryCli.introspect.commands[0]!)).toContain('如果需要验证，可优先使用 dry-run。')
  })

  test('filters catalog by query tokens', () => {
    const filtered = filterConnectorCatalog([inventoryCli], 'items create write')
    const empty = filterConnectorCatalog([inventoryCli], 'github')

    expect(filtered).toHaveLength(1)
    expect(countConnectorCommands(filtered[0]!)).toBe(2)
    expect(empty).toHaveLength(0)
  })

  test('inserts snippet at the current selection', () => {
    expect(insertTextAtSelection('abc', 1, 2, 'XYZ')).toEqual({
      value: 'aXYZc',
      selectionStart: 4,
      selectionEnd: 4,
    })
    expect(insertTextAtSelection('abc', 99, 99, 'X')).toEqual({
      value: 'abcX',
      selectionStart: 4,
      selectionEnd: 4,
    })
  })
})
