export type PendingCompile = {
  yaml: string
  workflowId: string
  params: Record<string, unknown>
  summary: string
  intent: string
  usedDefaultParams?: string[]
}

const memory = new Map<string, PendingCompile>()
const STORAGE_KEY = 'helios-pending-compiles-v1'

function readDisk(): Record<string, PendingCompile> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PendingCompile>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDisk(all: Record<string, PendingCompile>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // ignore quota / private mode
  }
}

export function getPendingCompile(conversationId: string): PendingCompile | null {
  if (memory.has(conversationId)) {
    return memory.get(conversationId) ?? null
  }
  const fromDisk = readDisk()[conversationId]
  if (fromDisk) {
    memory.set(conversationId, fromDisk)
    return fromDisk
  }
  return null
}

export function setPendingCompile(
  conversationId: string,
  pending: PendingCompile | null,
): void {
  const disk = readDisk()
  if (!pending) {
    memory.delete(conversationId)
    delete disk[conversationId]
  } else {
    memory.set(conversationId, pending)
    disk[conversationId] = pending
  }
  writeDisk(disk)
}
