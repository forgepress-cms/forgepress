<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue'
import { errorMessage } from '../../../src/utils/error'
import { useRouter } from '../../composables/useRouter'
import ErrorAlert from '../ErrorAlert.vue'

const { route } = useRouter()

const loading = ref(true)
const failure = ref('')
const visit = ref(0)

watch(route, () => {
  visit.value += 1
  failure.value = ''
})

onErrorCaptured((error) => {
  if (!loading.value)
    return true

  failure.value = errorMessage(error)

  return false
})
</script>

<template>
  <ErrorAlert v-if="failure" title="This page could not be loaded" :error="failure" />

  <Suspense v-else @pending="loading = true" @resolve="loading = false">
    <component :is="route.page" :key="visit" />
  </Suspense>
</template>
