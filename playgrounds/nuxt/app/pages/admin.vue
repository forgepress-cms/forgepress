<script setup lang="ts">
import { mountEditor } from 'webenv/editor'

const host = useTemplateRef('host')

onMounted(() => {
  const unmount = mountEditor(host.value)

  onBeforeUnmount(unmount)
})
</script>

<template>
  <div id="webenv" ref="host" />
</template>
