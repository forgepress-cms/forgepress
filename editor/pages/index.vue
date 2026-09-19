<script setup lang="ts">
import { useContent } from '../composables/useContent'
import { useRouter } from '../composables/useRouter'

const { href } = useRouter()

const editable = await useContent().mode() === 'development'
</script>

<template>
  <UPageGrid :class="editable ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
    <UPageCard
      variant="ghost"
      class="sheet"
      title="Content"
      description="Browse and edit the entries of every collection."
      icon="i-hugeicons-file-text"
      :to="href('content')"
      :ui="{
        root: 'hover:bg-neutral-200',
      }"
    />

    <UPageCard
      v-if="editable"
      variant="ghost"
      class="sheet"
      title="Schema"
      description="Inspect the collections and fields the project defines."
      icon="i-hugeicons-layout-table-01"
      :to="href('schema')"
      :ui="{
        root: 'hover:bg-neutral-200',
      }"
    />

    <UPageCard
      variant="ghost"
      class="sheet"
      title="Assets"
      description="Manage the files the content references."
      icon="i-hugeicons-image-01"
      :to="href('assets')"
      :ui="{
        root: 'hover:bg-neutral-200',
      }"
    />
  </UPageGrid>
</template>
