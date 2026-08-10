<script setup lang="ts">
import { source } from '../../../../content/source'
import { useRouter } from '../../../router'

const { route, href } = useRouter()

const name = route.value.params.component

if (!name) {
  throw new Error('Component name is required')
}

const component = await source.list(name).then((components) => {
  const component = components.find(c => c.id === route.value.params.id)

  if (!component) {
    throw new Error(`Component with id ${route.value.params.id} not found`)
  }

  return component
})
</script>

<template>
  <div class="grid gap-4">
    <div class="flex items-center gap-3">
      <UButton
        :to="href(`content/${name}`)"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :aria-label="`Back to ${name}`"
      />

      <h1 class="text-xl font-semibold text-highlighted">
        {{ component.id }}
      </h1>
    </div>

    <UCard>
      <pre class="overflow-x-auto text-xs text-muted">{{ component }}</pre>
    </UCard>
  </div>
</template>
