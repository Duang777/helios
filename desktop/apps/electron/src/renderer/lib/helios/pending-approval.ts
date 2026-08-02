import type { PendingApproval } from './business-turn'

const memory = new Map<string, PendingApproval>()
const STORAGE_KEY = 'helios-pending-approvals-v1'

function readDisk(): Record<string, PendingApproval> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, PendingApproval>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDisk(all: Record<string, PendingApproval>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // ignore quota / private mode
  }
}

export function getPendingApproval(conversationId: string): PendingApproval | null {
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

export function setPendingApproval(
  conversationId: string,
  pending: PendingApproval | null,
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
