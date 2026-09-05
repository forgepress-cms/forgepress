import type { Draft, DraftService, DraftSummary, DraftTarget, FileDiff } from '../types/content/draft'
import type { BakedMedia, MediaAsset, MediaClient, PendingUpload } from '../types/content/media'
import type { ContentSource } from '../types/content/reader'
import type { ContentStore, KeyValueStore } from '../types/content/store'
import { diffLines } from './diff'
import { prefixer } from './forge'
import { assetUrl, mediaType, toAssetName } from './media'
import { CONTENT_DIR, SCHEMA_FILE, toFileName } from './paths'
import { serializeContent, serializeSchema } from './serialize'

function plain<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue
}

function empty(): Draft {
  return { components: {}, uploads: {}, removed: [] }
}

async function digest(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)

  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function createDraft(base: ContentSource, baked: () => Promise<BakedMedia>, store: KeyValueStore<Draft>): DraftService {
  let loaded: Promise<Draft> | undefined

  const previews = new Map<string, string>()

  function ready(): Promise<Draft> {
    loaded ??= store.read().then(draft => draft ?? empty())

    return loaded
  }

  async function mutate(apply: (draft: Draft) => void): Promise<void> {
    const draft = await ready()

    apply(draft)

    delete draft.published

    await store.write(draft)
  }

  function preview(upload: PendingUpload): string {
    if (typeof URL.createObjectURL !== 'function')
      return ''

    let url = previews.get(upload.name)

    if (!url) {
      url = URL.createObjectURL(new Blob([upload.data], { type: upload.type }))
      previews.set(upload.name, url)
    }

    return url
  }

  function asset(upload: PendingUpload, prefix: string): MediaAsset {
    const local = preview(upload)

    return {
      name: upload.name,
      url: assetUrl(prefix, upload.name),
      type: upload.type,
      size: upload.size,
      modifiedAt: upload.modifiedAt,
      ...local ? { preview: local } : {},
    }
  }

  function forget(name: string): void {
    const url = previews.get(name)

    if (!url)
      return

    URL.revokeObjectURL(url)
    previews.delete(name)
  }

  async function reset(): Promise<void> {
    for (const name of [...previews.keys()])
      forget(name)

    loaded = Promise.resolve(empty())

    await store.clear()
  }

  const content: ContentStore = {
    schema: async () => (await ready()).schema ?? await base.schema(),

    list: async (component) => {
      const pending = (await ready()).components[component]

      if (pending === null)
        return []

      return pending ?? await base.list(component)
    },

    writeSchema: schema => mutate((draft) => {
      draft.schema = plain(schema)
    }),

    writeContent: (component, rows) => mutate((draft) => {
      draft.components[component] = plain(rows)
    }),

    removeContent: component => mutate((draft) => {
      draft.components[component] = null
    }),
  }

  const media: MediaClient = {
    list: async () => {
      const { url, assets } = await baked()
      const draft = await ready()
      const removed = new Set(draft.removed)

      const uploaded = Object.values(draft.uploads).map(upload => asset(upload, url))
      const existing = assets.filter(item => !removed.has(item.name) && !(item.name in draft.uploads))

      return [...uploaded, ...existing].sort((left, right) =>
        right.modifiedAt.localeCompare(left.modifiedAt) || left.name.localeCompare(right.name))
    },

    upload: async (file) => {
      const { url, maxSize } = await baked()
      const type = mediaType(file.name)

      if (!type)
        throw new Error(`[webenv] "${file.name}" is not a supported media file`)

      const data = await file.arrayBuffer()

      if (data.byteLength > maxSize)
        throw new Error(`[webenv] "${file.name}" is larger than the ${Math.round(maxSize / 1024 / 1024)} MB upload limit`)

      const upload: PendingUpload = {
        name: toAssetName(file.name, await digest(data)),
        type,
        size: data.byteLength,
        modifiedAt: new Date().toISOString(),
        data,
      }

      await mutate((draft) => {
        draft.uploads[upload.name] = upload
        draft.removed = draft.removed.filter(name => name !== upload.name)
      })

      return asset(upload, url)
    },

    remove: async (name) => {
      await mutate((draft) => {
        if (draft.uploads[name])
          delete draft.uploads[name]
        else if (!draft.removed.includes(name))
          draft.removed.push(name)
      })

      forget(name)
    },
  }

  return {
    content,
    media,

    snapshot: ready,

    summary: async () => {
      const draft = await ready()
      const components = Object.entries(draft.components)

      return {
        ...draft.published === undefined ? {} : { published: draft.published },
        schema: draft.schema !== undefined,
        written: components.filter(([, rows]) => rows !== null).map(([component]) => component),
        dropped: components.filter(([, rows]) => rows === null).map(([component]) => component),
        uploaded: Object.keys(draft.uploads),
        deleted: [...draft.removed],
      } satisfies DraftSummary
    },

    diff: async (target: DraftTarget) => {
      const draft = await ready()
      const at = prefixer(target.base)
      const diffs: FileDiff[] = []

      if (draft.schema !== undefined) {
        diffs.push({
          path: at(SCHEMA_FILE),
          change: 'changed',
          lines: diffLines(serializeSchema(await base.schema(), target.format), serializeSchema(draft.schema, target.format)),
        })
      }

      for (const [component, rows] of Object.entries(draft.components)) {
        const path = at(`${CONTENT_DIR}/${toFileName(component)}`)
        const existing = await base.list(component)
        const before = existing.length > 0 ? serializeContent(component, existing, target.format) : ''

        if (rows === null) {
          diffs.push({ path, change: 'removed', lines: diffLines(before, '') })

          continue
        }

        const after = serializeContent(component, rows, target.format)

        diffs.push({ path, change: before ? 'changed' : 'added', lines: diffLines(before, after) })
      }

      const { url, assets } = await baked()

      for (const upload of Object.values(draft.uploads))
        diffs.push({ path: at(`${target.mediaDir}/${upload.name}`), change: 'added', after: asset(upload, url) })

      for (const name of draft.removed) {
        const found = assets.find(item => item.name === name)

        diffs.push({ path: at(`${target.mediaDir}/${name}`), change: 'removed', ...found ? { before: found } : {} })
      }

      return diffs
    },

    published: async (commit) => {
      const draft = await ready()

      draft.published = commit

      await store.write(draft)
    },

    discard: reset,
  }
}
