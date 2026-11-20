'use client'

import { mountEditor } from 'forgepress/editor'
import { useEffect, useRef } from 'react'

export default function Admin() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => mountEditor(host.current, {
    preview: ({ collection, entry }) => collection === 'page' && entry ? entry.slug : undefined,
  }), [])

  return <div id="forgepress" ref={host} />
}
