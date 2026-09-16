<script setup lang="ts">
import type { MediaAsset } from '../../src/media/types'
import { computed, ref, shallowRef } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ErrorAlert from '../components/ErrorAlert.vue'
import PageHeader from '../components/layout/PageHeader.vue'
import MediaDetails from '../components/media/MediaDetails.vue'
import MediaGrid from '../components/media/MediaGrid.vue'
import MediaUpload from '../components/media/MediaUpload.vue'
import { useContent } from '../composables/useContent'
import { useMedia } from '../composables/useMedia'

const library = useMedia()

await library.ensure()

const local = await useContent().mode() === 'development'

const selected = ref<string[]>([])
const search = ref('')
const removing = ref<string[]>([])
const shown = shallowRef<MediaAsset>()
const showing = ref(false)

const items = computed(() => {
  const query = search.value.trim().toLowerCase()

  return library.assets.value.filter(asset => asset.name.toLowerCase().includes(query))
})

function show(asset: MediaAsset): void {
  shown.value = asset
  showing.value = true
}

async function remove(): Promise<void> {
  const names = removing.value

  removing.value = []

  for (const name of names)
    await library.remove(name)

  selected.value = selected.value.filter(name => !names.includes(name))

  if (shown.value && names.includes(shown.value.name))
    showing.value = false
}
</script>

<template>
  <div class="grid gap-8">
    <PageHeader title="Assets" description="Images and videos uploaded from the editor.">
      <template #actions>
        <UButton
          v-if="selected.length"
          :label="`Delete ${selected.length}`"
          icon="i-hugeicons-delete-02"
          color="error"
          variant="subtle"
          @click="removing = [...selected]"
        />

        <MediaUpload multiple @uploaded="library.refresh()" />
      </template>
    </PageHeader>

    <ErrorAlert title="The media library could not be loaded" :error="library.error.value" />

    <UInput
      v-model="search"
      placeholder="Search"
      icon="i-hugeicons-search-01"
      class="max-w-xs"
    />

    <MediaGrid
      v-model="selected"
      :assets="items"
      multiple
      @open="show"
      @remove="removing = [$event.name]"
    />

    <p v-if="!items.length" class="rounded-lg border border-dashed border-accented py-10 text-center text-sm text-muted">
      {{ library.assets.value.length ? 'No assets match the search.' : 'Nothing uploaded yet.' }}
    </p>

    <MediaDetails v-model:open="showing" :asset="shown" @remove="removing = [$event.name]" />

    <ConfirmDialog
      :open="!!removing.length"
      :title="removing.length === 1 ? 'Delete asset' : 'Delete assets'"
      :description="`${removing.length} ${removing.length === 1 ? 'file is' : 'files are'} ${local ? 'deleted from disk right away' : 'deleted from the repository when you publish'}. Content still pointing at ${removing.length === 1 ? 'it' : 'them'} will break.`"
      @update:open="removing = []"
      @confirm="remove()"
    />
  </div>
</template>
