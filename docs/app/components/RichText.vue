<script setup lang="ts">
import { marked } from 'marked'

const props = defineProps<{ source?: string }>()

const html = computed(() => props.source ? marked.parse(props.source, { async: false }) : '')
</script>

<template>
  <div class="rich-text" v-html="html" />
</template>
