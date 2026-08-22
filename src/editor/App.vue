<script setup lang="ts">
import Header from './components/layout/Header.vue'

import { useRouter } from './router'

/** The shadow root's container, which every overlay has to be portalled into to be styled. */
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
            <component :is="route.page" />
          </Suspense>
        </UContainer>
      </main>
    </div>
  </UApp>
</template>
