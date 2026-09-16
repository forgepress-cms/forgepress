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
    <div class="grid min-w-0 gap-1">
      <UBreadcrumb v-if="breadcrumb?.length" :items="breadcrumb" class="mb-1" />

      <h1 class="font-display text-3xl leading-[1.05] font-bold tracking-[-0.035em] wrap-anywhere text-highlighted lg:text-[2.5rem]">
        {{ title }}
      </h1>

      <p v-if="description || $slots.description" class="text-sm text-muted">
        <slot name="description">
          {{ description }}
        </slot>
      </p>
    </div>

    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
