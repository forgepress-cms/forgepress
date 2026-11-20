<script setup lang="ts">
import { mountEditor } from 'forgepress/editor'

const host = useTemplateRef('host')

onMounted(() => {
  const unmount = mountEditor(host.value, {
    preview: ({ collection, entry, locale }) => collection === 'page' && entry ? `${entry.slug}?locale=${locale ?? 'en'}` : undefined,
  })

  onBeforeUnmount(unmount)
})
</script>

<template>
  <div id="forgepress" ref="host" />
</template>
