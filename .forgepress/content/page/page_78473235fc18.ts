import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'page_78473235fc18',
  status: 'published',
  createdAt: '2026-09-15T12:34:34.160Z',
  updatedAt: '2026-09-15T12:34:34.160Z',
  title: 'Nuxt',
  slug: '/nuxt',
  content: 'Install ForgePress and add its module to `nuxt.config.ts`:\n\n```sh\npnpm add forgepress\n```\n\n```ts\nexport default defineNuxtConfig({\n  modules: [\'forgepress/nuxt\'],\n})\n```\n\nThe module adds the ForgePress Vite plugin, lets TypeScript see your schema and entries, and turns on the preview for editors who are signed in. Query content with `query()` inside `useAsyncData`: pages render it at build time, and the preview loads it again in the browser when an editor changes something.\n\n```vue\n<script setup lang="ts">\nimport { query } from \'forgepress\'\n\nconst { data: posts } = await useAsyncData(\'posts\', () => query(\'blogPost\').locale(\'en\').sort(\'createdAt\', \'desc\'))\n</script>\n```\n\nThe editor is a page you add yourself, for example `app/pages/admin.vue`:\n\n```vue\n<script setup lang="ts">\nimport { mountEditor } from \'forgepress/editor\'\n\nconst host = useTemplateRef(\'host\')\n\nonMounted(() => {\n  const unmount = mountEditor(host.value)\n\n  onBeforeUnmount(unmount)\n})\n</script>\n\n<template>\n  <div ref="host" />\n</template>\n```\n\nOptions go under the `forgepress` key of `nuxt.config.ts`. `preview: false` leaves the preview out. `write: false` turns off writing files in development, so the editor there works like the deployed one.',
} satisfies ForgePressEntry<'page'>
