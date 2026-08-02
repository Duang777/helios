/**
 * ModeSwitcher - 业务对话 / Agent 模式切换
 *
 * Helios 业务模式下固定为「业务对话」，不展示 Agent 切换。
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { appModeAtom, type AppMode } from '@/atoms/app-mode'
import { heliosBusinessEnabledAtom } from '@/atoms/helios-business'
import { conversationsAtom, currentConversationIdAtom } from '@/atoms/chat-atoms'
import { agentSessionsAtom, currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { tabsAtom } from '@/atoms/tab-atoms'
import { useOpenSession } from '@/hooks/useOpenSession'
import { Bot, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const modes: { value: AppMode; label: string; icon: React.ReactNode }[] = [
  { value: 'chat', label: '业务对话', icon: <MessageSquare size={15} /> },
  { value: 'agent', label: 'Agent', icon: <Bot size={15} /> },
]

export function ModeSwitcher(): React.ReactElement {
  const [mode, setMode] = useAtom(appModeAtom)
  const heliosBusiness = useAtomValue(heliosBusinessEnabledAtom)
  const openSession = useOpenSession()
  const conversations = useAtomValue(conversationsAtom)
  const agentSessions = useAtomValue(agentSessionsAtom)
  const currentConversationId = useAtomValue(currentConversationIdAtom)
  const currentAgentSessionId = useAtomValue(currentAgentSessionIdAtom)
  const tabs = useAtomValue(tabsAtom)

  React.useEffect(() => {
    if (heliosBusiness && mode !== 'chat') {
      setMode('chat')
    }
  }, [heliosBusiness, mode, setMode])

  const restoreSession = React.useCallback((targetMode: AppMode) => {
    const isChatMode = targetMode === 'chat'
    const sessions = isChatMode ? conversations : agentSessions
    const lastId = isChatMode ? currentConversationId : currentAgentSessionId

    if (lastId) {
      const match = sessions.find((s) => s.id === lastId)
      if (match) {
        openSession(targetMode, match.id, match.title)
        return
      }
    }
    const tab = tabs.find((t) => t.type === targetMode)
    if (tab) {
      openSession(targetMode, tab.sessionId, tab.title)
      return
    }
    const recent = sessions.find((s) => !s.archived)
    if (recent) {
      openSession(targetMode, recent.id, recent.title)
      return
    }
    setMode(targetMode)
  }, [openSession, conversations, agentSessions, currentConversationId, currentAgentSessionId, tabs, setMode])

  const handleModeSwitch = React.useCallback((targetMode: AppMode) => {
    if (heliosBusiness && targetMode !== 'chat') return
    if (targetMode === mode) return
    restoreSession(targetMode)
  }, [mode, restoreSession, heliosBusiness])

  if (heliosBusiness) {
    return (
      <div className="pt-2 titlebar-drag-region select-none">
        <div className="flex h-10 items-center gap-2 rounded-xl px-3 titlebar-no-drag sidebar-control-surface">
          <MessageSquare size={15} className="text-primary" />
          <span className="text-sm font-medium text-foreground">业务对话</span>
        </div>
      </div>
    )
  }

  const visibleModes = modes
  const chatIndex = visibleModes.findIndex((m) => m.value === 'chat')
  const agentIndex = visibleModes.findIndex((m) => m.value === 'agent')
  const selectedIndex = mode === 'agent' ? agentIndex : chatIndex

  return (
    <div className="pt-2 titlebar-drag-region select-none">
      <div className="relative flex rounded-xl p-1 titlebar-drag-region mode-switcher-track sidebar-control-surface">
        <div
          className={cn(
            'mode-slider pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-background shadow-sm transition-transform duration-300 ease-in-out',
            selectedIndex === 0 ? 'translate-x-0' : 'translate-x-full',
          )}
        />
        {visibleModes.map(({ value, label, icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleModeSwitch(value)}
            className={cn(
              'mode-btn titlebar-no-drag relative z-[1] h-8 flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-0 text-sm font-medium transition-colors duration-200 select-none',
              mode === value
                ? 'mode-btn-selected text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
