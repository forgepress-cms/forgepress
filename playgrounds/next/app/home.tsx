'use client'

import type { Home } from './content'
import { query } from 'forgepress'
import { usePreviewData } from 'forgepress/react'
import { useState } from 'react'
import { loadHome } from './content'

export function HomePage({ home }: { home: Home }) {
  const { page, pages } = usePreviewData(home, loadHome)
  const [latest, setLatest] = useState<string>()

  async function getLatest() {
    setLatest((await query('page').sort('updatedAt', 'desc').first())?.title)
  }

  return (
    <main>
      {page && (
        <section>
          <h1>{page.title}</h1>
          <p>{page.content}</p>
        </section>
      )}

      <div>
        <h2>Pages</h2>
        <ul>
          {pages.map(item => (
            <li key={item.id}>
              {item.title}
              {' · '}
              {item.slug}
            </li>
          ))}
        </ul>
      </div>

      <button type="button" onClick={getLatest}>
        Get Latest Page in Browser
      </button>

      {latest && (
        <div>
          <h2>Latest Page</h2>
          <p>{latest}</p>
        </div>
      )}
    </main>
  )
}
