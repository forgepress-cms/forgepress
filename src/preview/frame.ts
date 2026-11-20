import type { CollectionEntry } from '../entries'
import { isRecord } from '../utils'

export const FRAME_SOURCE = 'forgepress:frame'

export interface FrameDraft {
  entries: CollectionEntry[]
  server?: string
}

export type FrameMessage
  = { source: typeof FRAME_SOURCE, type: 'ready' }
    | { source: typeof FRAME_SOURCE, type: 'draft', entries: CollectionEntry[], server?: string }

export function readyMessage(): FrameMessage {
  return { source: FRAME_SOURCE, type: 'ready' }
}

export function draftMessage(draft: FrameDraft): FrameMessage {
  return { source: FRAME_SOURCE, type: 'draft', ...draft }
}

function isDraftEntry(value: unknown): value is CollectionEntry {
  return isRecord(value) && typeof value.collection === 'string' && isRecord(value.entry) && typeof value.entry.id === 'string'
}

export function frameMessage(data: unknown): FrameMessage | undefined {
  if (!isRecord(data) || data.source !== FRAME_SOURCE)
    return undefined

  if (data.type === 'ready')
    return readyMessage()

  if (data.type !== 'draft' || !Array.isArray(data.entries) || !data.entries.every(isDraftEntry))
    return undefined

  return draftMessage({ entries: data.entries, ...typeof data.server === 'string' ? { server: data.server } : {} })
}

export function followEditor(apply: (draft: FrameDraft) => void): void {
  if (typeof window === 'undefined' || window.parent === window)
    return

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin)
      return

    const message = frameMessage(event.data)

    if (message?.type === 'draft')
      apply({ entries: message.entries, ...message.server === undefined ? {} : { server: message.server } })
  })

  window.parent.postMessage(readyMessage(), window.location.origin)
}
