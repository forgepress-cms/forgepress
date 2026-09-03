<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Header from './components/layout/Header.vue'
import SignIn from './components/SignIn.vue'
import { useContent } from './composables/useContent'
import { useRouter } from './composables/useRouter'
import { useSession } from './composables/useSession'

defineProps<{
  container: HTMLElement
}>()

const { route } = useRouter()
const content = useContent()
const { identity, provider, restore } = useSession()

const ready = ref(false)

onMounted(async () => {
  try {
    if (await content.mode() === 'static')
      await restore()
  }
  finally {
    ready.value = true
  }
})

const locked = computed(() => ready.value && provider.value !== undefined && identity.value === undefined)
</script>

<template>
  <UApp :portal="container">
    <div class="fixed inset-0 overflow-y-auto bg-default text-default">
      <div v-if="!ready" class="flex min-h-dvh items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <SignIn v-else-if="locked" />

      <template v-else>
        <Header />

        <main class="pt-6 pb-16">
          <UContainer>
            <Suspense>
              <component :is="route.page" :key="route.path" />
            </Suspense>
          </UContainer>
        </main>
      </template>
    </div>
  </UApp>
</template>
