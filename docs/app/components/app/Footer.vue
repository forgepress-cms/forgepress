<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <UFooter>
    <template #left>
      <p class="text-sm text-muted">
        {{ t('footer.copyright') }}
      </p>
    </template>

    <template #right>
      <UButton :label="t('nav.github')" to="https://github.com/forgepress-cms/forgepress" target="_blank" color="neutral" variant="ghost" />

      <UButton :label="t('footer.editor')" to="/admin" color="neutral" variant="ghost" />
    </template>
  </UFooter>
</template>
