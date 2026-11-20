import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { CollectionEntry, Entry } from '../../src/entries'
import type { Schema } from '../../src/schema'
import { computed, ref, shallowRef, watch } from 'vue'
import { toOutputEntry } from '../../src/output'
import { draftMessage, frameMessage } from '../../src/preview'
import { fillPreview, previewPlaceholders } from '../../src/schema'
import { readLocal, writeLocal } from '../../src/store'

export interface PreviewContext {
  schema: Schema
  collection: string
  id?: string
  entry?: Entry
}

export interface PreviewServer {
  local: boolean
  devServer: string
}

export interface PreviewPane {
  available: ComputedRef<boolean>
  wide: Ref<boolean>
  docked: Ref<boolean>
  overlay: Ref<boolean>
  open: ComputedRef<boolean>
  ratio: Ref<number>
  resizing: Ref<boolean>
  locale: Ref<string | undefined>
  locales: ComputedRef<readonly string[]>
  url: ComputedRef<string | undefined>
  hint: ComputedRef<string>
  address: Ref<string>
  loading: Ref<boolean>
  toggle: () => void
  close: () => void
  resize: (ratio: number) => void
  show: (context: PreviewContext) => () => void
  draft: (entries: readonly CollectionEntry[]) => void
  attach: (frame: HTMLIFrameElement) => () => void
  reload: () => void
  dispose: () => void
}

export const previewKey: InjectionKey<PreviewPane> = Symbol('forgepress:editor:preview')

const WIDE_QUERY = '(min-width: 64rem)'
export const DEFAULT_RATIO = 0.5

const DOCKED_KEY = 'forgepress:editor:preview'
const RATIO_KEY = 'forgepress:editor:preview-ratio'
const MIN_RATIO = 0.2
const MAX_RATIO = 0.8

const names = new Intl.ListFormat('en')

export function clampRatio(value: number): number {
  return Number.isFinite(value) ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, value)) : DEFAULT_RATIO
}

export function previewTarget(context: PreviewContext, template: string, locale: string | undefined): { url?: string, hint: string } {
  if (context.id === undefined || !context.entry)
    return { hint: 'Save the entry to see its page.' }

  const filled = fillPreview(template, { ...toOutputEntry(context.schema, context.collection, context.entry, locale), locale })

  if ('missing' in filled) {
    const fields = context.schema.collections[context.collection]?.fields ?? {}

    return { hint: `Fill in ${names.format(filled.missing.map(name => fields[name]?.label ?? name))} and save to see the page.` }
  }

  if (new URL(filled.path, window.location.href).origin !== window.location.origin)
    return { hint: 'The address of this entry leads off the site.' }

  return { url: filled.path, hint: '' }
}

function addressOf(frame: HTMLIFrameElement, fallback: string): string {
  try {
    const { pathname, search, hash } = frame.contentWindow!.location

    return `${pathname}${search}${hash}`
  }
  catch {
    return fallback
  }
}

export function createPreviewPane(server: () => Promise<PreviewServer>): PreviewPane {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : undefined

  const wide = ref(media?.matches ?? true)
  const docked = ref(readLocal(DOCKED_KEY) === '1')
  const overlay = ref(false)
  const ratio = ref(clampRatio(Number(readLocal(RATIO_KEY) ?? DEFAULT_RATIO)))
  const resizing = ref(false)
  const context = shallowRef<PreviewContext>()
  const locale = ref<string>()
  const address = ref('')
  const loading = ref(false)

  let frame: HTMLIFrameElement | undefined
  let entries: CollectionEntry[] = []

  const template = computed(() => {
    const current = context.value

    return current ? current.schema.collections[current.collection]?.preview || undefined : undefined
  })

  const available = computed(() => template.value !== undefined)
  const open = computed(() => available.value && (wide.value ? docked.value : overlay.value))
  const locales = computed<readonly string[]>(() => template.value && previewPlaceholders(template.value).includes('locale') ? context.value?.schema.locales ?? [] : [])
  const target = computed(() => context.value && template.value ? previewTarget(context.value, template.value, locale.value) : undefined)
  const url = computed(() => target.value?.url)
  const hint = computed(() => target.value?.hint ?? '')

  function follow(event: MediaQueryListEvent): void {
    wide.value = event.matches
  }

  function post(): void {
    const view = frame?.contentWindow

    if (!view)
      return

    void server().then((settings) => {
      view.postMessage(draftMessage({ entries, ...settings.local ? { server: settings.devServer } : {} }), window.location.origin)
    })
  }

  function receive(event: MessageEvent): void {
    if (!frame || event.source !== frame.contentWindow || event.origin !== window.location.origin)
      return

    if (frameMessage(event.data)?.type === 'ready')
      post()
  }

  function navigate(next: string | undefined): void {
    if (next === undefined) {
      loading.value = false
      address.value = ''

      return
    }

    if (!frame)
      return

    const href = new URL(next, window.location.href).href

    loading.value = true
    address.value = next

    try {
      frame.contentWindow!.location.replace(href)
    }
    catch {
      frame.src = href
    }
  }

  function persistRatio(): void {
    writeLocal(RATIO_KEY, String(ratio.value))
  }

  media?.addEventListener('change', follow)
  window.addEventListener('message', receive)

  watch(url, navigate)

  watch(context, (next) => {
    if (!next)
      return

    const listed = next.schema.locales ?? []

    if (listed.length === 0)
      locale.value = undefined
    else if (!locale.value || !listed.includes(locale.value))
      locale.value = next.schema.defaultLocale ?? listed[0]
  })

  watch(docked, value => writeLocal(DOCKED_KEY, value ? '1' : undefined))

  watch(wide, () => {
    overlay.value = false
  })

  watch(resizing, (active) => {
    if (!active)
      persistRatio()
  })

  return {
    available,
    wide,
    docked,
    overlay,
    open,
    ratio,
    resizing,
    locale,
    locales,
    url,
    hint,
    address,
    loading,

    toggle: () => {
      if (wide.value)
        docked.value = !docked.value
      else
        overlay.value = !overlay.value
    },

    close: () => {
      if (wide.value)
        docked.value = false
      else
        overlay.value = false
    },

    resize: (next) => {
      ratio.value = clampRatio(next)

      if (!resizing.value)
        persistRatio()
    },

    show: (next) => {
      context.value = next

      return () => {
        if (context.value === next)
          context.value = undefined
      }
    },

    draft: (next) => {
      entries = JSON.parse(JSON.stringify(next)) as CollectionEntry[]
      post()
    },

    attach: (element) => {
      frame = element

      const loaded = (): void => {
        loading.value = false
        address.value = addressOf(element, url.value ?? '')
      }

      element.addEventListener('load', loaded)

      if (url.value !== undefined) {
        loading.value = true
        address.value = url.value
        element.src = new URL(url.value, window.location.href).href
      }

      return () => {
        element.removeEventListener('load', loaded)

        if (frame === element)
          frame = undefined
      }
    },

    reload: () => {
      if (!frame || url.value === undefined)
        return

      loading.value = true

      try {
        frame.contentWindow!.location.reload()
      }
      catch {
        frame.src = new URL(url.value, window.location.href).href
      }
    },

    dispose: () => {
      media?.removeEventListener('change', follow)
      window.removeEventListener('message', receive)
      frame = undefined
    },
  }
}
