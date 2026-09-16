import { EVENTS } from '../endpoint/routes'
import settings from './settings'

const RETRY = 1000
const LONGEST_RETRY = 30000

function connect(delay: number): void {
  const socket = new WebSocket(`${settings.devServer.replace(/^http/, 'ws')}${EVENTS}`)
  let opened = false

  socket.addEventListener('open', () => {
    opened = true
  })

  socket.addEventListener('message', (event) => {
    if (event.data === 'reload')
      location.reload()
  })

  socket.addEventListener('close', () => {
    const next = opened ? RETRY : Math.min(delay * 2, LONGEST_RETRY)

    setTimeout(connect, next, next)
  })
}

connect(RETRY)
