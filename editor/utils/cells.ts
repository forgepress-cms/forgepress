import type { VNode } from 'vue'
import type { MediaKind } from '../../src/media'
import type { MediaContent } from '../../src/media/types'
import type { Entries } from '../composables/useEntries'
import type { FormField } from './schema'
import { h } from 'vue'
import { isEntryRef } from '../../src/entries/references'
import { asList } from '../../src/utils/value'
import MediaPreview from '../components/media/MediaPreview.vue'
import { markdownInline, markdownText } from './markdown'
import { toList } from './media'
import { line } from './preview'

const THUMBNAILS = 3

export function clamp(value: string, width = 'max-w-64'): VNode {
  return h('span', { class: `block truncate ${width}`, title: value }, value)
}

export function clampMarkdown(value: string, width = 'max-w-64'): VNode {
  return h('span', {
    class: `block truncate ${width} [&_code]:rounded [&_code]:bg-elevated [&_code]:px-1 [&_code]:text-xs [&_strong]:text-highlighted`,
    title: markdownText(value),
    innerHTML: markdownInline(value),
  })
}

export function thumbnails(items: MediaContent[], kind: MediaKind): VNode {
  if (!items.length)
    return h('span', { class: 'text-dimmed' }, '—')

  return h('div', { class: 'flex items-center gap-1' }, [
    ...items.slice(0, THUMBNAILS).map(item => h(
      'span',
      { class: 'block h-8 w-12 overflow-hidden rounded bg-elevated', title: item.alt ?? '' },
      h(MediaPreview, { url: item.url, kind, alt: item.alt }),
    )),
    items.length > THUMBNAILS && h('span', { class: 'text-xs text-muted' }, `+${items.length - THUMBNAILS}`),
  ])
}

export function fieldCell(field: FormField, value: unknown, entries: Entries): VNode {
  const config = field.config

  if (config.type === 'image' || config.type === 'video')
    return thumbnails(toList(value), config.type)

  if (config.type === 'richtext')
    return clampMarkdown(String(value ?? ''))

  if (config.type === 'relation')
    return clamp(line(asList(value).map(id => entries.label(config.collection, id))))

  if (config.type === 'dynamic')
    return clamp(line(asList(value).filter(isEntryRef).map(block => entries.label(block.collection, block.id))))

  return clamp(line(value))
}
