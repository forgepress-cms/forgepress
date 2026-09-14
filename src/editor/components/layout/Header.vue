<script setup lang="ts">
import type { ColorMode } from '../../plugins/color-mode'
import { computed, onMounted, ref } from 'vue'

import { useColorMode } from '../../composables/useColorMode'
import { usePublish } from '../../composables/usePublish'
import { useRouter } from '../../composables/useRouter'
import { useSession } from '../../composables/useSession'
import PublishDialog from '../PublishDialog.vue'

import Logo from './Logo.vue'

const props = defineProps<{
  deployed: boolean
}>()

const { route, href } = useRouter()
const { mode, cycle } = useColorMode()
const { identity, signOut } = useSession()
const { count, refresh } = usePublish()

const showPublish = ref(false)

onMounted(refresh)

const account = computed(() => [[
  { label: identity.value?.login ?? '', type: 'label' as const },
  { label: 'Sign out', icon: 'i-lucide-log-out', onSelect: () => void signOut() },
]])

const links = computed(() => [
  { label: 'Content', to: 'content' },
  ...props.deployed ? [] : [{ label: 'Schema', to: 'schema' }],
  { label: 'Assets', to: 'assets' },
])

const icons: Record<ColorMode, string> = {
  light: 'i-lucide-sun',
  dark: 'i-lucide-moon',
}
</script>

<template>
  <UHeader :to="href()" :ui="{ root: 'sticky top-0 z-10' }">
    <template #title>
      <Logo />

      <strong class="font-semibold">ForgePress</strong>
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
        v-if="identity"
        icon="i-lucide-upload"
        :label="count ? `Publish (${count})` : 'Publish'"
        @click="showPublish = true"
      />

      <UDropdownMenu v-if="identity" :items="account">
        <UButton :label="identity.login" icon="i-lucide-user" color="neutral" variant="ghost" />
      </UDropdownMenu>

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

  <PublishDialog v-model:open="showPublish" />
</template>
