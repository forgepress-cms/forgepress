<script setup lang="ts">
import type { ColorMode } from '../../plugins/color-mode'
import { computed, onMounted, ref, watch } from 'vue'

import { useColorMode } from '../../composables/useColorMode'
import { usePreview } from '../../composables/usePreview'
import { usePublish } from '../../composables/usePublish'
import { useRouter } from '../../composables/useRouter'
import { useSession } from '../../composables/useSession'
import PublishDialog from '../PublishDialog.vue'

import BuildStatus from './BuildStatus.vue'
import Logo from './Logo.vue'

const props = defineProps<{
  deployed: boolean
}>()

const { route, href } = useRouter()
const { mode, cycle } = useColorMode()
const { identity, signOut } = useSession()
const { count, refresh } = usePublish()
const { enabled: previewing, set: setPreview } = usePreview()

const showPublish = ref(false)
const menu = ref(false)

onMounted(refresh)

watch(route, () => {
  menu.value = false
})

function publish(): void {
  menu.value = false
  showPublish.value = true
}

const account = computed(() => [[
  { label: identity.value?.login ?? '', type: 'label' as const },
], [
  { label: 'Sign out', icon: 'i-hugeicons-logout-03', onSelect: () => void signOut() },
]])

const links = computed(() => [
  { label: 'Content', to: 'content' },
  ...props.deployed ? [] : [{ label: 'Schema', to: 'schema' }],
  { label: 'Assets', to: 'assets' },
])

const icons: Record<ColorMode, string> = {
  light: 'i-hugeicons-sun-03',
  dark: 'i-hugeicons-moon-02',
}

const setting = { root: 'flex-row-reverse items-center justify-between gap-3 px-4 py-3', wrapper: 'ms-0', label: 'font-normal text-highlighted' }
</script>

<template>
  <UHeader
    v-model:open="menu"
    :to="href()"
    :menu="{ title: 'Menu', description: 'Pages and settings of the editor' }"
    :ui="{ root: 'sticky top-0 z-10 border-transparent bg-desk/80', title: 'items-center gap-2', content: 'bg-desk', body: 'grid content-start gap-4' }"
  >
    <template #title>
      <Logo />

      <strong class="font-display text-[1.375rem] font-bold tracking-[-0.03em]" :class="identity && 'max-sm:sr-only'">ForgePress</strong>
    </template>

    <template #right>
      <UButton
        v-for="link in links"
        :key="link.to"
        :to="href(link.to)"
        :label="link.label"
        color="neutral"
        variant="ghost"
        class="hidden px-3.5 lg:inline-flex"
        :class="route.path.startsWith(link.to) && 'sheet'"
      />

      <BuildStatus v-if="deployed && identity" />

      <UButton
        v-if="identity && count"
        icon="i-hugeicons-upload-01"
        :label="`Publish (${count})`"
        @click="publish()"
      />

      <UDropdownMenu v-if="identity" :items="account">
        <UButton :label="identity.login" icon="i-hugeicons-user" color="neutral" variant="ghost" class="hidden lg:inline-flex" />
      </UDropdownMenu>

      <USwitch
        v-if="identity"
        :model-value="previewing"
        label="Site preview"
        :ui="{ root: 'hidden shrink-0 flex-row-reverse items-center gap-2 px-2 lg:flex', wrapper: 'ms-0', label: 'font-normal whitespace-nowrap' }"
        @update:model-value="setPreview"
      />

      <UButton
        :icon="icons[mode]"
        color="neutral"
        variant="ghost"
        class="hidden lg:inline-flex"
        :aria-label="`Color mode: ${mode}`"
        :title="`Color mode: ${mode}`"
        @click="cycle()"
      />
    </template>

    <template #body>
      <nav class="sheet grid divide-y divide-default overflow-hidden rounded-lg">
        <UButton
          v-for="link in links"
          :key="link.to"
          :to="href(link.to)"
          :label="link.label"
          color="neutral"
          variant="ghost"
          size="xl"
          trailing-icon="i-hugeicons-arrow-right-01"
          class="rounded-none px-4 py-3"
          :class="route.path.startsWith(link.to) ? 'text-primary' : 'text-highlighted'"
          :aria-current="route.path.startsWith(link.to) ? 'page' : undefined"
          :ui="{ trailingIcon: 'ms-auto text-dimmed' }"
        />
      </nav>

      <div class="sheet grid divide-y divide-default rounded-lg">
        <USwitch
          v-if="identity"
          :model-value="previewing"
          label="Site preview"
          :ui="setting"
          @update:model-value="setPreview"
        />

        <USwitch
          :model-value="mode === 'dark'"
          label="Dark mode"
          :ui="setting"
          @update:model-value="cycle()"
        />
      </div>

      <div v-if="identity" class="sheet grid divide-y divide-default overflow-hidden rounded-lg">
        <p class="px-4 py-3 text-sm text-muted">
          Signed in as <span class="font-medium text-highlighted">{{ identity.login }}</span>
        </p>

        <UButton
          label="Sign out"
          icon="i-hugeicons-logout-03"
          color="neutral"
          variant="ghost"
          size="xl"
          class="rounded-none px-4 py-3 text-highlighted"
          @click="signOut()"
        />
      </div>
    </template>
  </UHeader>

  <PublishDialog v-model:open="showPublish" />
</template>
