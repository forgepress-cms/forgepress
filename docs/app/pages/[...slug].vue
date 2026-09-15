<script setup lang="ts">
import { query } from 'forgepress'

const route = useRoute()

const slug = computed(() => `/${[route.params.slug ?? []].flat().filter(Boolean).join('/')}`)

const { data: page } = await useAsyncData(() => `page-${slug.value}`, () => query('page')
  .where('slug', slug.value)
  .first()
  .then(found => found ?? null))

if (!page.value)
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })

useHead({ title: () => page.value?.title })
</script>

<template>
  <main v-if="page" class="page">
    <h1>{{ page.title }}</h1>

    <RichText :source="page.content" />
  </main>
</template>

<style scoped>
.page {
  max-width: 44rem;
  margin: 0 auto;
  padding: 4rem 1.25rem;
}
</style>
