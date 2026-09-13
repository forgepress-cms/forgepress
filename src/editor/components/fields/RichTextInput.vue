<script setup lang="ts">
import type { EditorCustomHandlers, EditorHandler, EditorToolbarItem } from '@nuxt/ui'
import type { MediaAsset } from '../../../media/types'
import { ref, shallowRef } from 'vue'
import MediaLibrary from '../media/MediaLibrary.vue'

type Editor = Parameters<EditorHandler['execute']>[0]

const model = defineModel<string>({ required: true })

const picking = ref(false)
const target = shallowRef<Editor>()

const items: EditorToolbarItem[][] = [
  [
    { 'kind': 'heading', 'level': 2, 'icon': 'i-lucide-heading-2', 'aria-label': 'Heading' },
    { 'kind': 'heading', 'level': 3, 'icon': 'i-lucide-heading-3', 'aria-label': 'Subheading' },
  ],
  [
    { 'kind': 'mark', 'mark': 'bold', 'icon': 'i-lucide-bold', 'aria-label': 'Bold' },
    { 'kind': 'mark', 'mark': 'italic', 'icon': 'i-lucide-italic', 'aria-label': 'Italic' },
    { 'kind': 'mark', 'mark': 'strike', 'icon': 'i-lucide-strikethrough', 'aria-label': 'Strikethrough' },
    { 'kind': 'link', 'icon': 'i-lucide-link', 'aria-label': 'Link' },
  ],
  [
    { 'kind': 'bulletList', 'icon': 'i-lucide-list', 'aria-label': 'Bullet list' },
    { 'kind': 'orderedList', 'icon': 'i-lucide-list-ordered', 'aria-label': 'Numbered list' },
    { 'kind': 'blockquote', 'icon': 'i-lucide-text-quote', 'aria-label': 'Quote' },
    { 'kind': 'codeBlock', 'icon': 'i-lucide-code', 'aria-label': 'Code block' },
  ],
  [
    { 'kind': 'image', 'icon': 'i-lucide-image', 'aria-label': 'Image' },
    { 'kind': 'horizontalRule', 'icon': 'i-lucide-minus', 'aria-label': 'Divider' },
  ],
  [
    { 'kind': 'undo', 'icon': 'i-lucide-undo-2', 'aria-label': 'Undo' },
    { 'kind': 'redo', 'icon': 'i-lucide-redo-2', 'aria-label': 'Redo' },
  ],
]

const handlers: EditorCustomHandlers = {
  image: {
    canExecute: editor => editor.can().insertContent({ type: 'image' }),
    isActive: editor => editor.isActive('image'),
    execute: (editor) => {
      target.value = editor
      picking.value = true

      return editor.chain()
    },
  },
}

function insert(assets: MediaAsset[]): void {
  const editor = target.value

  if (!editor)
    return

  assets
    .reduce(
      (chain, asset) => chain.insertContent({ type: 'image', attrs: { src: asset.url, alt: asset.name } }),
      editor.chain().focus(),
    )
    .run()
}
</script>

<template>
  <div class="w-full">
    <UEditor
      v-model="model"
      content-type="markdown"
      :mention="false"
      :handlers="handlers"
      placeholder="Write something…"
      class="overflow-hidden rounded-md bg-default ring ring-accented focus-within:ring-2 focus-within:ring-primary"
      :ui="{ base: 'px-3 py-2 sm:px-3 *:my-3 min-h-40 text-sm' }"
    >
      <template #default="{ editor }">
        <UEditorToolbar
          :editor="editor"
          :items="items"
          size="xs"
          class="border-b border-default bg-elevated/50"
        />
      </template>
    </UEditor>

    <MediaLibrary
      v-model:open="picking"
      kind="image"
      multiple
      @select="insert"
    />
  </div>
</template>
