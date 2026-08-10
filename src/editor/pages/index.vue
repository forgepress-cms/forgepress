<script setup lang="ts">
import Card from '../components/layout/Card.vue'
import { useRouter } from '../router'

const { href } = useRouter()
</script>

<template>
  <div class="grid sm:grid-cols-3 gap-6">
    <Card :to="href('content')">
      Content
    </Card>

    <Card :to="href('schema')">
      Schema
    </Card>

    <Card :to="href('assets')">
      Assets
    </Card>
  </div>
</template>
