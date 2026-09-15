'use client'

import { mountEditor } from 'forgepress/editor'
import { useEffect, useRef } from 'react'

export default function Admin() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => mountEditor(host.current), [])

  return <div id="forgepress" ref={host} />
}
