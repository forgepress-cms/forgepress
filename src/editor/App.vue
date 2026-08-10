<script setup lang="ts">
import { computed } from 'vue'
import Header from './components/layout/Header.vue'
import Assets from './pages/assets.vue'
import Content from './pages/content.vue'
import Index from './pages/index.vue'
import Schema from './pages/schema.vue'
import { useRouter } from './router'

const { route } = useRouter()

const pages = { content: Content, schema: Schema, assets: Assets }

const page = computed(() => route.value ? pages[route.value] : Index)
</script>

<template>
  <div class="fixed inset-0 overflow-y-auto bg-canvas text-fg">
    <Header />

    <main class="mx-auto w-full max-w-275 px-5 pt-6 pb-16">
      <component :is="page" />
    </main>
  </div>
</template>
