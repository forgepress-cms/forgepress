<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'

const { locale, t } = useI18n()

const head = useLocaleHead()

useHead({
  htmlAttrs: {
    lang: () => head.value.htmlAttrs.lang,
    dir: () => head.value.htmlAttrs.dir,
  },
  link: () => head.value.link ?? [],
  meta: () => head.value.meta ?? [],
})

useSeoMeta({
  titleTemplate: title => title ? `${title} · ${t('site.title')}` : t('site.title'),
  description: () => t('site.description'),
})
</script>

<template>
  <UApp :locale="locales[locale]">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
