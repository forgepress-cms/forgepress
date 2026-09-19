<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: '',
})
</script>

<template>
  <UPageHero
    :headline="t('hero.eyebrow')"
    :title="t('hero.title')"
    :description="t('hero.description')"
    :links="[
      { label: t('hero.editor'), to: '/admin', size: 'lg', class: 'px-4' },
      { label: t('hero.github'), to: 'https://github.com/forgepress-cms/forgepress', target: '_blank', size: 'lg', color: 'neutral', variant: 'ghost', class: 'sheet px-4' },
    ]"
  />
</template>
