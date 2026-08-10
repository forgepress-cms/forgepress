<script setup lang="ts">
import { source } from '../../content/source'

const schema = await source.schema()
</script>

<template>
  <div class="grid gap-4">
    <h1 class="text-xl font-semibold text-highlighted">
      Schema
    </h1>

    <UCard>
      <pre class="overflow-x-auto text-xs text-muted">{{ schema }}</pre>
    </UCard>
  </div>
</template>
