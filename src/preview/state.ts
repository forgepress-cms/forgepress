import type { ProviderConfig } from '../config/types'
import type { KeyValueStore } from '../store/types'
import { readLocal, readLocalJson, writeLocal } from '../store/local'

export interface PreviewSettings {
  provider: ProviderConfig
  contentPath: string
  mediaUrl: string
}

const SETTINGS_KEY = 'forgepress:preview'
const OFF_KEY = 'forgepress:preview:off'
const CHANNEL = 'forgepress:preview'

const listeners = new Set<() => void>()

let version = 0
let channel: BroadcastChannel | undefined
let listening = false

function emit(): void {
  version += 1

  for (const listener of [...listeners])
    listener()
}

function listen(): void {
  if (listening || typeof window === 'undefined')
    return

  listening = true

  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === SETTINGS_KEY || event.key === OFF_KEY)
      emit()
  })

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL)
    channel.addEventListener('message', emit)
  }
}

export function previewSettings(): PreviewSettings | undefined {
  return readLocalJson<PreviewSettings>(SETTINGS_KEY)
}

export function previewEnabled(): boolean {
  return readLocal(OFF_KEY) === null
}

export function previewing(): boolean {
  return typeof window !== 'undefined' && previewEnabled() && readLocal(SETTINGS_KEY) !== null
}

export function previewVersion(): number {
  return version
}

export function onPreviewChange(listener: () => void): () => void {
  listen()
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function setPreviewEnabled(enabled: boolean): void {
  if (previewEnabled() === enabled)
    return

  writeLocal(OFF_KEY, enabled ? undefined : '1')
  emit()
}

export function openPreview(settings: PreviewSettings): void {
  const text = JSON.stringify(settings)

  if (readLocal(SETTINGS_KEY) === text)
    return

  writeLocal(SETTINGS_KEY, text)
  emit()
}

export function closePreview(): void {
  if (readLocal(SETTINGS_KEY) === null)
    return

  writeLocal(SETTINGS_KEY, undefined)
  emit()
}

export function announceChanges(): void {
  listen()
  channel?.postMessage('changes')
  emit()
}

export function announcing<TValue>(store: KeyValueStore<TValue>): KeyValueStore<TValue> {
  return {
    read: () => store.read(),

    write: async (value) => {
      await store.write(value)
      announceChanges()
    },

    clear: async () => {
      await store.clear()
      announceChanges()
    },
  }
}
