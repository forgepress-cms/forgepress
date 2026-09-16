<script setup lang="ts">
import type { MediaKind } from '../../../src/media'
import type { MediaAsset } from '../../../src/media/types'
import { computed, ref, watch } from 'vue'
import { mediaKind } from '../../../src/media'
import { useMedia } from '../../composables/useMedia'
import ErrorAlert from '../ErrorAlert.vue'
import MediaGrid from './MediaGrid.vue'
import MediaUpload from './MediaUpload.vue'

const props = defineProps<{
  kind: MediaKind
  multiple?: boolean | undefined
}>()

const emit = defineEmits<{ select: [MediaAsset[]] }>()

const open = defineModel<boolean>('open', { required: true })

const library = useMedia()

const selected = ref<string[]>([])
const search = ref('')

const items = computed(() => {
  const query = search.value.trim().toLowerCase()

  return library.assets.value.filter(asset =>
    mediaKind(asset.name) === props.kind && asset.name.toLowerCase().includes(query),
  )
})

watch(open, (value) => {
  selected.value = []
  search.value = ''

  if (value)
    void library.ensure()
})

function uploaded(assets: MediaAsset[]): void {
  selected.value = props.multiple
    ? [...selected.value, ...assets.map(asset => asset.name)]
    : assets.slice(0, 1).map(asset => asset.name)
}

function insert(): void {
  const assets = selected.value
    .map(name => library.assets.value.find(asset => asset.name === name))
    .filter(asset => !!asset)

  emit('select', assets)

  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Media library"
    :description="`Pick ${multiple ? 'files' : 'a file'} from ${kind === 'video' ? 'the uploaded videos' : 'the uploaded images'}.`"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div class="grid gap-4">
        <div class="flex items-center gap-2">
          <UInput
            v-model="search"
            placeholder="Search"
            icon="i-hugeicons-search-01"
            class="flex-1"
          />

          <MediaUpload
            :kind="kind"
            :multiple="multiple"
            color="neutral"
            variant="outline"
            @uploaded="uploaded"
          />
        </div>

        <ErrorAlert title="The media library could not be loaded" :error="library.error.value" />

        <MediaGrid v-model="selected" :assets="items" :multiple="multiple" />

        <p v-if="!items.length && !library.pending.value" class="py-6 text-center text-sm text-muted">
          No {{ kind === 'video' ? 'videos' : 'images' }} uploaded yet.
        </p>
      </div>
    </template>

    <template #footer>
      <UButton label="Insert" :disabled="!selected.length" @click="insert()" />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
