import { enablePreview, onPreviewChange, previewing } from 'forgepress/preview'

export default defineNuxtPlugin((nuxtApp) => {
  enablePreview()

  const { enabled } = usePreviewMode({ shouldEnable: previewing })

  onPreviewChange(() => nuxtApp.runWithContext(() => {
    enabled.value = previewing()

    return refreshNuxtData()
  }))
})
