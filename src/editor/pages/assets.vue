<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ErrorAlert from '../components/ErrorAlert.vue'
import PageHeader from '../components/layout/PageHeader.vue'
import MediaGrid from '../components/media/MediaGrid.vue'
import MediaUpload from '../components/media/MediaUpload.vue'
import { useMedia } from '../composables/useMedia'

const library = useMedia()

await library.ensure()

const selected = ref<string[]>([])
const search = ref('')
const removing = ref<string[]>([])

const items = computed(() => {
  const query = search.value.trim().toLowerCase()

  return library.assets.value.filter(asset => asset.name.toLowerCase().includes(query))
})

async function remove(): Promise<void> {
  const names = removing.value

  removing.value = []

  for (const name of names)
    await library.remove(name)

  selected.value = selected.value.filter(name => !names.includes(name))
}
</script>

<template>
  <div class="grid gap-6">
    <PageHeader title="Assets" description="Images and videos uploaded from the editor.">
      <template #actions>
        <UButton
          v-if="selected.length"
          :label="`Delete ${selected.length}`"
          icon="i-lucide-trash-2"
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
      icon="i-lucide-search"
      class="max-w-xs"
    />

    <MediaGrid
      v-model="selected"
      :assets="items"
      multiple
      removable
      @remove="removing = [$event.name]"
    />

    <p v-if="!items.length" class="rounded-lg border border-dashed border-default py-10 text-center text-sm text-muted">
      {{ library.assets.value.length ? 'No assets match the search.' : 'Nothing uploaded yet.' }}
    </p>

    <ConfirmDialog
      :open="!!removing.length"
      :title="removing.length === 1 ? 'Delete asset' : 'Delete assets'"
      :description="`${removing.length} ${removing.length === 1 ? 'file is' : 'files are'} deleted from disk. Content still pointing at ${removing.length === 1 ? 'it' : 'them'} will break.`"
      @update:open="removing = []"
      @confirm="remove()"
    />
  </div>
</template>
