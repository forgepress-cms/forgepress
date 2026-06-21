<script setup lang="ts">
import { mountEditor } from 'webenv/editor'

const host = useTemplateRef('host')

onMounted(() => {
  const unmount = mountEditor(host.value)

  onUnmounted(unmount)
})
</script>

<template>
  <div ref="host" id="webenv" />
</template>
