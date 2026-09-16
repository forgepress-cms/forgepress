<script setup lang="ts">
import { useContent } from '../composables/useContent'
import { useRouter } from '../composables/useRouter'

const { href } = useRouter()

const editable = await useContent().mode() === 'development'
</script>

<template>
  <UPageGrid :class="editable ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
    <UPageCard
      title="Content"
      description="Browse and edit the entries of every collection."
      icon="i-lucide-file-text"
      :to="href('content')"
    />

    <UPageCard
      v-if="editable"
      title="Schema"
      description="Inspect the collections and fields the project defines."
      icon="i-lucide-layout-list"
      :to="href('schema')"
    />

    <UPageCard
      title="Assets"
      description="Manage the files the content references."
      icon="i-lucide-image"
      :to="href('assets')"
    />
  </UPageGrid>
</template>
