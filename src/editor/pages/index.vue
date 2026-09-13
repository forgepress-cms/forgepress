<script setup lang="ts">
import { useRouter } from '../composables/useRouter'

const { href } = useRouter()
</script>

<template>
  <UPageGrid class="sm:grid-cols-3">
    <UPageCard
      title="Content"
      description="Browse and edit the entries of every collection."
      icon="i-lucide-file-text"
      :to="href('content')"
    />

    <UPageCard
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
