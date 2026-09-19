<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />

    <UMain class="min-h-0 flex-1">
      <slot />
    </UMain>

    <AppFooter />
  </div>
</template>
