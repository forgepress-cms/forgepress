<script setup lang="ts">
import Header from './components/layout/Header.vue'

import { useRouter } from './composables/useRouter'

defineProps<{
  container: HTMLElement
}>()

const { route } = useRouter()
</script>

<template>
  <UApp :portal="container">
    <div class="fixed inset-0 overflow-y-auto bg-default text-default">
      <Header />

      <main class="pt-6 pb-16">
        <UContainer>
          <Suspense>
            <component :is="route.page" :key="route.path" />
          </Suspense>
        </UContainer>
      </main>
    </div>
  </UApp>
</template>
