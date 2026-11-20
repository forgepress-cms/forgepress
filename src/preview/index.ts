import type { ContentReader } from '../query/client'
import type { BadgeState } from './badge'
import type { PreviewFiles, PreviewReader } from './reader'
import type { PreviewSource } from './state'
import { overlayContent } from '../query/overlay'
import { errorMessage } from '../utils/error'
import { once } from '../utils/once'
import { createBadge } from './badge'
import { followEditor } from './frame'
import { contentVersion, framedPreview, onPreviewChange, previewDraft, previewing, previewSettings, previewSource, previewVersion, setFramedDraft, setPreviewEnabled } from './state'

export { onPreviewChange, previewing } from './state'

interface Snapshot {
  version: number
  files: Promise<PreviewFiles | undefined>
}

let enabled = false
let snapshot: Snapshot | undefined
let built: number | undefined
let selected: { key: string, reader: () => Promise<PreviewReader> } | undefined

const badge = createBadge(setPreviewEnabled)

function announce(state: BadgeState): void {
  if (framedPreview())
    badge.hide()
  else
    badge.show(state)
}

function readerFor(source: PreviewSource): Promise<PreviewReader> {
  const key = JSON.stringify(source)

  if (selected?.key !== key)
    selected = { key, reader: once(() => import('./reader').then(module => module.createPreviewReader(source))) }

  return selected.reader()
}

function load(): Promise<PreviewFiles | undefined> {
  const version = previewVersion()

  if (snapshot?.version === version)
    return snapshot.files

  const source = previewSource()
  const fresh = built !== contentVersion()

  built = contentVersion()

  const building = source
    ? readerFor(source).then(reader => reader.build(previewDraft(), fresh))
    : Promise.reject(new Error('[forgepress] sign in to the editor to preview unpublished content'))

  const current: Snapshot = {
    version,
    files: building.then((files) => {
      if (snapshot === current && previewing())
        announce({ status: 'ready' })

      return files
    }, (cause: unknown) => {
      built = undefined

      if (snapshot === current && previewing())
        announce({ status: 'failed', error: errorMessage(cause) })

      return undefined
    }),
  }

  snapshot = current
  announce({ status: 'loading' })

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
  else if (previewSettings() && !framedPreview())
    badge.show({ status: 'off' })
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
    followEditor(setFramedDraft)
    refresh()
  }

  return previewing()
}
