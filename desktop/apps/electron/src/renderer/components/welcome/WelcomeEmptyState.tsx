/**
 * WelcomeEmptyState — Helios 业务对话空状态引导
 */

import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Lightbulb } from 'lucide-react'
import { userProfileAtom } from '@/atoms/user-profile'
import { chatPendingMessageAtom } from '@/atoms/chat-atoms'
import { activeTabIdAtom, tabsAtom } from '@/atoms/tab-atoms'

function getGreeting(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

const SUGGESTIONS = [
  '帮我看看 Hacker News 热帖',
  '同步一条销售线索',
]

export function WelcomeEmptyState(): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  const tabs = useAtomValue(tabsAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const setChatPending = useSetAtom(chatPendingMessageAtom)

  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const displayName = userProfile.userName || '你好'

  const handleSuggestion = React.useCallback((text: string): void => {
    const active = tabs.find((t) => t.id === activeTabId)
    const sessionId = active?.sessionId
    if (!sessionId) return
    setChatPending({ conversationId: sessionId, message: text })
  }, [tabs, activeTabId, setChatPending])

  return (
    <div className="welcome-empty-state flex h-full flex-col items-center justify-center gap-6 px-4">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium tracking-wide text-primary">Helios</p>
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
          {displayName}，{greeting}
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          用自然语言描述目标，我会连上本机工作流引擎，用卡片告诉你步骤和结果。
        </p>
      </div>

      <div className="flex items-center gap-2.5 rounded-full bg-muted/50 px-4 py-2 text-[13px] text-muted-foreground">
        <Lightbulb size={14} className="flex-shrink-0 text-amber-500/80" />
        <span>先启动 ./scripts/dev-api.sh，再点下面的快捷建议</span>
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => handleSuggestion(text)}
            className="rounded-lg border border-border/80 bg-background/80 px-3.5 py-2 text-[13px] text-foreground/90 hover:bg-muted/60 transition-colors"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
