import type { KeyValueStore } from '../store/types'
import type { ProviderConfig } from '../types/config'

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

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function write(key: string, value: string | undefined): void {
  try {
    if (value === undefined)
      localStorage.removeItem(key)
    else
      localStorage.setItem(key, value)
  }
  catch {
  }
}

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
  const text = read(SETTINGS_KEY)

  try {
    return text ? JSON.parse(text) as PreviewSettings : undefined
  }
  catch {
    return undefined
  }
}

export function previewEnabled(): boolean {
  return read(OFF_KEY) === null
}

export function previewing(): boolean {
  return typeof window !== 'undefined' && previewEnabled() && read(SETTINGS_KEY) !== null
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

  write(OFF_KEY, enabled ? undefined : '1')
  emit()
}

export function openPreview(settings: PreviewSettings): void {
  const text = JSON.stringify(settings)

  if (read(SETTINGS_KEY) === text)
    return

  write(SETTINGS_KEY, text)
  emit()
}

export function closePreview(): void {
  if (read(SETTINGS_KEY) === null)
    return

  write(SETTINGS_KEY, undefined)
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
