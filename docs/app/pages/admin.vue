<script setup lang="ts">
import { mountEditor } from 'forgepress/editor'

const host = useTemplateRef('host')

onMounted(() => {
  const unmount = mountEditor(host.value)

  onBeforeUnmount(unmount)
})
</script>

<template>
  <div id="forgepress" ref="host" />
</template>
