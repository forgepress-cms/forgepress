<script setup lang="ts">
import { query } from 'forgepress'

const route = useRoute()

const locale = computed(() => route.query.locale === 'de' ? 'de' : 'en')

const { data: page } = await useAsyncData(() => `page:${locale.value}:${route.path}`, () =>
  query('page')
    .locale(locale.value)
    .where('slug', route.path)
    .first()
    .then(found => found ?? null))
</script>

<template>
  <main>
    <section v-if="page">
      <h1>{{ page.title }}</h1>
      <p v-if="page.description">
        {{ page.description }}
      </p>
    </section>

    <p v-else>
      No page has the slug {{ route.path }}.
    </p>
  </main>
</template>
