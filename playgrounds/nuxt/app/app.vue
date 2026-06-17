<script setup lang="ts">
import { query } from 'webenv'

const id = 'author-1'
const ids = ['author-1', 'author-2']

const allAuthors = await query('author')

const allAuthorsPopulated = await query('author', {
  populate: ['*'],
})

const test = await query('author', id)
 
const test2 = await query('author', id, {
  pick: ['name'],
})

const test3 = await query('author', id, {
  pick: ['name'],
  populate: ['blogPosts'],
})

const test4 = await query('author', ids, {
  pick: ['name'],
  populate: ['blogPosts'],
})
</script>

<template>
  <div>
    All Authors
    <pre>{{ allAuthors }}</pre>

    All Authors (All fields populated)
    <pre>{{ allAuthorsPopulated }}</pre>

    Test (Single Author)
    <pre>{{ test }}</pre>

    Test 2 (Single Author, Picked name only)
    <pre>{{ test2 }}</pre>

    Test 3 (Single Author, Picked name only, Populated blogPosts)
    <pre>{{ test3 }}</pre>

    Test 4 (Multiple Authors, Picked name only, Populated blogPosts)
    <pre>{{ test4 }}</pre>
  </div>
</template>
