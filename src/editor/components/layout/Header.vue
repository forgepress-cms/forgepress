<script setup lang="ts">
import { useRouter } from '../../router'
import Logo from './Logo.vue'

const { href } = useRouter()
</script>

<template>
  <header class="sticky top-0 z-2 flex items-center justify-between gap-4 border-b border-line bg-panel px-5 py-3">
    <a :href="href()" class="flex items-center gap-2">
      <Logo />

      <strong class="font-semibold">Webenv</strong>
    </a>
  </header>
</template>
