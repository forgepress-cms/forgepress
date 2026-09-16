export type BadgeState = { status: 'loading' | 'ready' | 'off' } | { status: 'failed', error: string }

export interface Badge {
  show: (state: BadgeState) => void
  hide: () => void
}

const TAG = 'forgepress-preview'
const HIDING = 'forgepress-preview-hiding'

const LABELS: Record<BadgeState['status'], string> = {
  loading: 'Loading preview…',
  ready: 'Preview: on',
  off: 'Preview: off',
  failed: 'Preview unavailable',
}

const STYLE = `
:host {
  all: initial;
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 2147483647;
}

.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 12px;
  border-radius: 999px;
  background: #13110e;
  color: #fffcf8;
  font: 500 13px/20px ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 4px 16px rgb(19 17 14 / 0.3);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffd27a;
}

[data-status="loading"] .dot {
  animation: pulse 1s ease-in-out infinite;
}

[data-status="failed"] .dot {
  background: #f87171;
}

[data-status="off"] .dot {
  background: #8a8378;
}

button {
  all: unset;
  padding: 2px 10px;
  border-radius: 999px;
  color: #ffd27a;
  cursor: pointer;
}

.close {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 2px;
  color: #b8b0a4;
}

.close svg {
  width: 12px;
  height: 12px;
}

button:hover {
  background: rgb(255 252 248 / 0.12);
}

button:focus-visible {
  outline: 2px solid #ffd27a;
  outline-offset: 2px;
}

@keyframes pulse {
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-status="loading"] .dot {
    animation: none;
  }
}
`

export function createBadge(setEnabled: (enabled: boolean) => void): Badge {
  let host: HTMLElement | undefined
  let badge: HTMLElement | undefined
  let label: HTMLElement | undefined
  let toggle: HTMLButtonElement | undefined
  let latest: BadgeState | undefined
  let dismissed = false

  function hideInEditor(): void {
    if (document.getElementById(HIDING))
      return

    const style = document.createElement('style')

    style.id = HIDING
    style.textContent = `body:has([data-forgepress-editor]) > ${TAG} { display: none !important; }`
    document.head.append(style)
  }

  function mount(): void {
    hideInEditor()

    host = document.createElement(TAG)
    badge = document.createElement('div')
    label = document.createElement('span')
    toggle = document.createElement('button')

    const root = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    const dot = document.createElement('span')
    const close = document.createElement('button')

    style.textContent = STYLE
    badge.className = 'badge'
    badge.setAttribute('role', 'status')
    dot.className = 'dot'
    toggle.type = 'button'
    toggle.addEventListener('click', () => setEnabled(latest?.status === 'off'))
    close.type = 'button'
    close.className = 'close'
    close.title = 'Hide until the page reloads'
    close.setAttribute('aria-label', 'Hide the preview badge')
    close.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>'
    close.addEventListener('click', () => {
      dismissed = true
      host?.remove()
    })

    badge.append(dot, label, toggle, close)
    root.append(style, badge)
    document.body.append(host)
  }

  function show(state: BadgeState): void {
    latest = state

    if (dismissed)
      return

    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => latest && show(latest), { once: true })

      return
    }

    if (!host?.isConnected)
      mount()

    badge!.dataset.status = state.status
    label!.textContent = LABELS[state.status]
    toggle!.textContent = state.status === 'off' ? 'Turn on' : 'Turn off'
    toggle!.setAttribute('aria-label', state.status === 'off' ? 'Turn on preview' : 'Turn off preview')
    badge!.title = state.status === 'failed' ? `${state.error}. The site shows published content.` : ''
  }

  return {
    show,

    hide: () => {
      latest = undefined
      host?.remove()
    },
  }
}
