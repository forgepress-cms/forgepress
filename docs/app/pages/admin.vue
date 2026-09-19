<script setup lang="ts">
import { mountEditor } from 'forgepress/editor'

definePageMeta({
  layout: false,
  i18n: false,
})

const host = useTemplateRef('host')

onMounted(() => {
  const unmount = mountEditor(host.value)

  onBeforeUnmount(unmount)
})
</script>

<template>
  <div id="forgepress" ref="host" />
</template>
