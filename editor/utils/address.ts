export function updateAddress(url: string, push = false): void {
  window.history[push ? 'pushState' : 'replaceState'](null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
}
