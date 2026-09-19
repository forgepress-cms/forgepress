<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <UHeader :to="localePath('/')" :toggle="false">
    <template #title>
      <Logo />

      <strong class="font-display text-[1.375rem] font-bold tracking-[-0.03em]">{{ t('site.title') }}</strong>
    </template>

    <template #right>
      <UButton
        :label="t('nav.github')"
        to="https://github.com/forgepress-cms/forgepress"
        target="_blank"
        color="neutral"
        variant="ghost"
        class="hidden px-3.5 sm:inline-flex"
      />

      <UButton :label="t('nav.editor')" to="/admin" color="neutral" variant="ghost" class="sheet px-3.5" />
    </template>
  </UHeader>
</template>
