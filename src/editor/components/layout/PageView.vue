<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue'
import { useRouter } from '../../composables/useRouter'
import ErrorAlert from '../ErrorAlert.vue'

const { route } = useRouter()

const loading = ref(true)
const failure = ref('')

watch(() => route.value.path, () => {
  failure.value = ''
})

onErrorCaptured((error) => {
  if (!loading.value)
    return true

  failure.value = error instanceof Error ? error.message : String(error)

  return false
})
</script>

<template>
  <ErrorAlert v-if="failure" title="This page could not be loaded" :error="failure" />

  <Suspense v-else @pending="loading = true" @resolve="loading = false">
    <component :is="route.page" :key="route.path" />
  </Suspense>
</template>
