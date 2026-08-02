/**
 * App Mode Atom - 应用模式状态
 *
 * - chat: 对话模式
 * - agent: Agent 模式（原 Flow）
 * - scratch: 草稿本模式
 */

import { atomWithStorage } from 'jotai/utils'

export type AppMode = 'chat' | 'agent' | 'scratch'

/** App 模式，自动持久化到 localStorage（Helios 默认业务对话） */
export const appModeAtom = atomWithStorage<AppMode>('helios-app-mode', 'chat')
