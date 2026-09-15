<script setup lang="ts">
import { query } from 'forgepress'

const { data: home } = await useAsyncData('home', () =>
  query('page')
    .where('slug', '/')
    .first()
    .then(page => page ?? null))

const { data: pages } = await useAsyncData('pages', () =>
  query('page')
    .sort('slug', 'asc')
    .pick('id', 'title', 'slug'))

const testQuery = () => query('page').sort('updatedAt', 'desc').first()
const test = ref<Awaited<ReturnType<typeof testQuery>>>()
async function getInBrowser() {
  test.value = await testQuery()
}
</script>

<template>
  <main>
    <section v-if="home">
      <h1>{{ home.title }}</h1>
      <p>{{ home.content }}</p>
    </section>

    <div>
      <h2>Pages</h2>
      <ul>
        <li v-for="page in pages" :key="page.id">
          {{ page.title }} · {{ page.slug }}
        </li>
      </ul>
    </div>

    <button @click="getInBrowser">
      Get Latest Page in Browser
    </button>

    <div v-if="test">
      <h2>Latest Page</h2>
      <p>{{ test.title }}</p>
    </div>
  </main>
</template>
