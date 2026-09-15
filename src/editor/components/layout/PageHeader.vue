<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import { useTitle } from '../../composables/useTitle'

const props = defineProps<{
  title: string
  breadcrumb?: BreadcrumbItem[]
  description?: string | undefined
}>()

defineSlots<{
  description?: () => unknown
  actions?: () => unknown
}>()

useTitle(() => props.title)
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="grid gap-1">
      <UBreadcrumb v-if="breadcrumb?.length" :items="breadcrumb" />

      <h1 class="text-xl lg:text-2xl font-semibold text-highlighted">
        {{ title }}
      </h1>

      <p v-if="description || $slots.description" class="text-sm text-muted">
        <slot name="description">
          {{ description }}
        </slot>
      </p>
    </div>

    <div v-if="$slots.actions" class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
