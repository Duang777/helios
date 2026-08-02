import * as React from 'react'
import { CheckCircle2, CircleAlert, ListTodo, ShieldQuestion } from 'lucide-react'
import type { CardEvent } from '@/lib/helios/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface HeliosCardsProps {
  events: CardEvent[]
  onApprove?: (runId: string, stepId: string) => void
  onReject?: (runId: string, stepId: string) => void
  onConfirmIntent?: () => void
  onCancelIntent?: () => void
  busy?: boolean
}

export function HeliosCards({
  events,
  onApprove,
  onReject,
  onConfirmIntent,
  onCancelIntent,
  busy,
}: HeliosCardsProps): React.ReactElement {
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {events.map((ev, i) => {
        if (ev.kind !== 'tool') return null
        return (
          <HeliosToolCard
            key={`${ev.toolName}-${i}`}
            event={ev}
            onApprove={onApprove}
            onReject={onReject}
            onConfirmIntent={onConfirmIntent}
            onCancelIntent={onCancelIntent}
            busy={busy}
          />
        )
      })}
    </div>
  )
}

function HeliosToolCard({
  event,
  onApprove,
  onReject,
  onConfirmIntent,
  onCancelIntent,
  busy,
}: {
  event: Extract<CardEvent, { kind: 'tool' }>
  onApprove?: (runId: string, stepId: string) => void
  onReject?: (runId: string, stepId: string) => void
  onConfirmIntent?: () => void
  onCancelIntent?: () => void
  busy?: boolean
}): React.ReactElement {
  const { toolName, input } = event

  if (toolName === 'confirm_intent') {
    // 仅 compile 闭环卡带 awaitConfirm；快捷演示 autoConfirm 不展示按钮
    const showActions =
      Boolean(input.awaitConfirm) && Boolean(onConfirmIntent || onCancelIntent)
    return (
      <CardShell tone="neutral" icon={<ListTodo className="size-4" />} title="目标确认">
        <p className="text-sm leading-relaxed text-foreground/90">
          {String(input.summary ?? '')}
        </p>
        {input.workflowId ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            工作流 {String(input.workflowId)}
          </p>
        ) : null}
        {showActions ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => onConfirmIntent?.()}>
              开始执行
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onCancelIntent?.()}
            >
              取消
            </Button>
          </div>
        ) : null}
      </CardShell>
    )
  }

  if (toolName === 'show_step') {
    const ok = input.status === 'COMPLETED'
    return (
      <CardShell
        tone={ok ? 'ok' : input.status === 'FAILED' ? 'bad' : 'neutral'}
        icon={ok ? <CheckCircle2 className="size-4" /> : <ListTodo className="size-4" />}
        title={String(input.title ?? '步骤')}
        meta={String(input.statusLabel ?? input.status ?? '')}
      >
        {input.detail ? (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {String(input.detail)}
          </p>
        ) : null}
      </CardShell>
    )
  }

  if (toolName === 'request_approval') {
    const runId = String(input.runId ?? '')
    const stepId = String(input.stepId ?? '')
    return (
      <CardShell
        tone="warn"
        icon={<ShieldQuestion className="size-4" />}
        title="需要你确认"
      >
        <p className="text-sm leading-relaxed mb-3">{String(input.prompt ?? '是否继续？')}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={busy || !runId}
            onClick={() => onApprove?.(runId, stepId)}
          >
            批准
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !runId}
            onClick={() => onReject?.(runId, stepId)}
          >
            拒绝
          </Button>
        </div>
      </CardShell>
    )
  }

  if (toolName === 'show_result') {
    const ok = Boolean(input.ok)
    const details = Array.isArray(input.details)
      ? (input.details as unknown[]).map(String)
      : []
    return (
      <CardShell
        tone={ok ? 'ok' : 'bad'}
        icon={ok ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}
        title={String(input.headline ?? (ok ? '完成' : '未完成'))}
      >
        {details.length > 0 ? (
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            {details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : null}
      </CardShell>
    )
  }

  return <></>
}

function CardShell({
  title,
  meta,
  icon,
  tone,
  children,
}: {
  title: string
  meta?: string
  icon: React.ReactNode
  tone: 'neutral' | 'ok' | 'bad' | 'warn'
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-xl border px-3.5 py-3',
        tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'bad' && 'border-destructive/30 bg-destructive/5',
        tone === 'warn' && 'border-amber-500/35 bg-amber-500/5',
        tone === 'neutral' && 'border-border/80 bg-muted/40',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{title}</span>
        {meta ? (
          <span className="ml-auto text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}
