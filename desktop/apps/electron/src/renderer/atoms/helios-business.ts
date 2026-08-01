/**
 * Helios 业务对话模式：发送走本机 Helios API，不依赖外部 LLM 渠道。
 */
import { atomWithStorage } from 'jotai/utils'

export const heliosBusinessEnabledAtom = atomWithStorage<boolean>(
  'helios-business-chat',
  true,
)
