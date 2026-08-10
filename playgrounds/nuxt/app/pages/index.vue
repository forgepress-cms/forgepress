<script setup lang="ts">
import { query } from 'webenv'

const { data: posts } = await useAsyncData('blog-posts', () =>
  query('blogPost')
    .locale('en')
    .with('author')
    .where('status', 'published')
    .sort('createdAt', 'desc'))

const { data: authors } = await useAsyncData('blog-authors', () =>
  query('author')
    .locale('en')
    .sort('name', 'asc')
    .pick('id', 'name'))

const testQuery = () => query('hero').locale('en').first()
const test = ref<Awaited<ReturnType<typeof testQuery>>>()
async function getInBrowser() {
  test.value = await testQuery()
}

const testQuery2 = () => query('author').locale('en').first()
const test2 = ref<Awaited<ReturnType<typeof testQuery2>>>()
async function getInBrowser2() {
  test2.value = await testQuery2()
}
</script>

<template>
  <main>
    <h1>Blog</h1>

    <article v-for="post in posts" :key="post.id">
      <h2>{{ post.title }}</h2>
      <p>by {{ post.author?.name }} · {{ new Date(post.createdAt).toLocaleDateString() }}</p>
      <p>{{ post.content }}</p>
    </article>

    <div>
      <h2>Authors</h2>
      <ul>
        <li v-for="author in authors" :key="author.id">
          {{ author.name }}
        </li>
      </ul>
    </div>

    <button @click="getInBrowser">
      Get Hero in Browser
    </button>

    <div v-if="test">
      <h2>Hero</h2>
      <p>{{ test.headline }}</p>
    </div>

    <button @click="getInBrowser2">
      Get Author in Browser
    </button>

    <div v-if="test2">
      <h2>Author</h2>
      <p>{{ test2.name }}</p>
    </div>
  </main>
</template>
