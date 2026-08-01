import type { CLIArgSpec, CLICommandSpec, RegisteredCLI } from '@/lib/helios/types'

export function normalizeConnectorQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function formatConnectorSideEffect(sideEffect: string): string {
  switch (sideEffect) {
    case 'write':
      return 'write'
    case 'read':
      return 'read'
    case 'none':
    default:
      return 'none'
  }
}

export function formatConnectorCommandPath(command: CLICommandSpec): string {
  return command.path.join(' ')
}

export function formatConnectorArg(arg: CLIArgSpec): string {
  const parts = [arg.name]
  if (arg.required) parts.push('必填')
  if (arg.enum && arg.enum.length > 0) {
    parts.push(`可选: ${arg.enum.join('|')}`)
  }
  if (arg.default !== undefined) {
    parts.push(`默认: ${String(arg.default)}`)
  }
  return parts.join(' · ')
}

export function buildConnectorInsertText(cli: RegisteredCLI, command: CLICommandSpec): string {
  const commandPath = formatConnectorCommandPath(command)
  const sideEffect = formatConnectorSideEffect(command.sideEffect)
  const argSummary = command.args && command.args.length > 0
    ? command.args.map(formatConnectorArg).join('；')
    : '无额外参数'

  return [
    `请优先使用连接器 \`${cli.name} ${commandPath}\`（${sideEffect}）。`,
    `参数：${argSummary}`,
    command.dryRun ? '如果需要验证，可优先使用 dry-run。' : '按真实执行路径编排。',
  ].join('\n')
}

export function insertTextAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insertion: string,
): { value: string; selectionStart: number; selectionEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length))
  const end = Math.max(start, Math.min(selectionEnd, value.length))
  const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`
  const nextCursor = start + insertion.length
  return {
    value: nextValue,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
  }
}

export function matchesConnectorQuery(
  cli: RegisteredCLI,
  command: CLICommandSpec,
  query: string,
): boolean {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return true
  const haystack = [
    cli.name,
    cli.version,
    command.path.join(' '),
    command.sideEffect,
    ...(command.args ?? []).map((arg) => [
      arg.name,
      arg.type,
      ...(arg.enum ?? []),
      arg.default == null ? '' : String(arg.default),
    ].join(' ')),
  ].join(' ').toLowerCase()
  return normalized.split(/\s+/).every((token) => haystack.includes(token))
}

export function filterConnectorCatalog(connectors: RegisteredCLI[], query: string): RegisteredCLI[] {
  const normalized = normalizeConnectorQuery(query)
  if (!normalized) return connectors
  return connectors.filter((cli) =>
    cli.introspect.commands.some((command) => matchesConnectorQuery(cli, command, normalized)),
  )
}

export function countConnectorCommands(cli: RegisteredCLI): number {
  return cli.introspect.commands.length
}
