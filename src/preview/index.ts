import type { ContentReader } from '../query/client'
import type { PreviewFiles, PreviewReader } from './reader'
import type { PreviewSettings } from './state'
import { overlayContent } from '../query/overlay'
import { errorMessage } from '../utils/error'
import { createBadge } from './badge'
import { onPreviewChange, previewing, previewSettings, previewVersion, setPreviewEnabled } from './state'

export { onPreviewChange, previewing } from './state'

interface Snapshot {
  version: number
  files: Promise<PreviewFiles | undefined>
}

let enabled = false
let snapshot: Snapshot | undefined
let selected: { key: string, reader: Promise<PreviewReader> } | undefined

const badge = createBadge(() => setPreviewEnabled(false))

function readerFor(settings: PreviewSettings): Promise<PreviewReader> {
  const key = JSON.stringify(settings)

  if (selected?.key !== key)
    selected = { key, reader: import('./reader').then(module => module.createPreviewReader(settings)) }

  return selected.reader
}

function load(): Promise<PreviewFiles | undefined> {
  const version = previewVersion()

  if (snapshot?.version === version)
    return snapshot.files

  const settings = previewSettings()
  const building = settings
    ? readerFor(settings).then(reader => reader.build())
    : Promise.reject(new Error('[forgepress] sign in to the editor to preview unpublished content'))

  const current: Snapshot = {
    version,
    files: building.then((files) => {
      if (snapshot === current)
        badge.show({ status: 'ready' })

      return files
    }, (cause: unknown) => {
      if (snapshot === current)
        badge.show({ status: 'failed', error: errorMessage(cause) })

      return undefined
    }),
  }

  snapshot = current
  badge.show({ status: 'loading' })

  return current.files
}

async function read(path: string, base: ContentReader): Promise<unknown> {
  if (!previewing())
    return base(path)

  const files = await load()

  if (!files)
    return base(path)

  const text = files.get(path)

  return text === undefined ? undefined : JSON.parse(text)
}

function refresh(): void {
  if (previewing())
    void load()
  else
    badge.hide()
}

export function enablePreview(): boolean {
  if (typeof window === 'undefined')
    return false

  if (!enabled) {
    enabled = true
    overlayContent(read)
    onPreviewChange(refresh)
    refresh()
  }

  return previewing()
}
