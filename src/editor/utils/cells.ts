import type { VNode } from 'vue'
import type { MediaKind } from '../../content/media'
import type { Entries } from '../composables/useEntries'
import type { MediaValue } from './media'
import type { Field } from './schema'
import { h } from 'vue'
import { asList } from '../../content/value'
import MediaPreview from '../components/media/MediaPreview.vue'
import { markdownInline, markdownText } from './markdown'
import { toList } from './media'
import { line } from './preview'

interface Block {
  type: string
  component: string
}

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

export function flag(value: boolean): VNode {
  return h('span', { class: value ? 'text-highlighted' : 'text-dimmed' }, value ? 'Yes' : '—')
}

export function thumbnails(items: MediaValue[], kind: MediaKind): VNode {
  if (!items.length)
    return h('span', { class: 'text-dimmed' }, '—')

  return h('div', { class: 'flex items-center gap-1' }, [
    ...items.slice(0, THUMBNAILS).map(item => h(
      'span',
      { class: 'block h-8 w-12 overflow-hidden rounded bg-elevated', title: item.alt ?? '' },
      h(MediaPreview, { url: item.url, kind, alt: item.alt }),
    )),
    items.length > THUMBNAILS && h('span', { class: 'text-xs text-dimmed' }, `+${items.length - THUMBNAILS}`),
  ])
}

function blocks(value: unknown): Block[] {
  return asList(value).filter((item): item is Block => typeof item === 'object' && item !== null)
}

export function fieldCell(field: Field, value: unknown, entries: Entries): VNode {
  const element = field.element

  if (element.type === 'image' || element.type === 'video')
    return thumbnails(toList(value), element.type)

  if (element.type === 'richtext')
    return clampMarkdown(String(value ?? ''))

  if (element.type === 'relation')
    return clamp(line(asList(value).map(id => entries.label(element.component, id))))

  if (element.type === 'dynamic')
    return clamp(line(blocks(value).map(block => entries.label(block.type, block.component))))

  return clamp(line(value))
}
