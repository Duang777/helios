import * as React from 'react'
import { fetchHealth, heliosBase } from '@/lib/helios/client'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Status = 'checking' | 'ok' | 'down'

export function HeliosEngineBadge(): React.ReactElement {
  const [status, setStatus] = React.useState<Status>('checking')
  const [scheduler, setScheduler] = React.useState<string>('')

  const refresh = React.useCallback(async () => {
    setStatus('checking')
    const health = await fetchHealth()
    if (!health) {
      setStatus('down')
      setScheduler('')
      return
    }
    setStatus('ok')
    setScheduler((health.scheduler || 'inprocess').toLowerCase())
  }, [])

  React.useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, 15_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const label =
    status === 'ok'
      ? scheduler === 'hatchet'
        ? 'Hatchet'
        : '引擎已连接'
      : status === 'down'
        ? '引擎未就绪'
        : '检测中…'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => {
            void refresh()
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              status === 'ok' && scheduler === 'hatchet' && 'bg-orange-500',
              status === 'ok' && scheduler !== 'hatchet' && 'bg-emerald-500',
              status === 'down' && 'bg-destructive',
              status === 'checking' && 'bg-amber-400 animate-pulse',
            )}
          />
          <span>Helios</span>
          <span className="text-foreground/70">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">
          {status === 'ok'
            ? `已连接 ${heliosBase()} · scheduler=${scheduler || 'inprocess'}`
            : `连不上 ${heliosBase()}。请先用 HELIOS_SCHEDULER=hatchet 重启 API（./scripts/dev-api-hatchet.sh）`}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
