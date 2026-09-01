<script setup lang="ts">
import type { ColorMode } from '../../plugins/color-mode'

import { useColorMode } from '../../composables/useColorMode'
import { useRouter } from '../../composables/useRouter'

import Logo from './Logo.vue'

const { route, href } = useRouter()
const { mode, cycle } = useColorMode()

const links = [
  { label: 'Content', to: 'content' },
  { label: 'Schema', to: 'schema' },
  { label: 'Assets', to: 'assets' },
]

const icons: Record<ColorMode, string> = {
  light: 'i-lucide-sun',
  dark: 'i-lucide-moon',
}
</script>

<template>
  <UHeader :to="href()" :ui="{ root: 'sticky top-0 z-10' }">
    <template #title>
      <Logo />

      <strong class="font-semibold">Webenv</strong>
    </template>

    <template #right>
      <UButton
        v-for="link in links"
        :key="link.to"
        :to="href(link.to)"
        :label="link.label"
        color="neutral"
        :variant="route.path.startsWith(link.to) ? 'soft' : 'ghost'"
      />

      <UButton
        :icon="icons[mode]"
        color="neutral"
        variant="ghost"
        :aria-label="`Color mode: ${mode}`"
        :title="`Color mode: ${mode}`"
        @click="cycle()"
      />
    </template>
  </UHeader>
</template>
