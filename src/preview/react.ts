import { useEffect, useRef, useState } from 'react'
import { enablePreview, onPreviewChange } from './index'

interface Previewed<TData> {
  from: TData
  data: TData
}

export function usePreviewData<TData>(data: TData, load: () => Promise<TData>): TData {
  const [previewed, setPreviewed] = useState<Previewed<TData>>()
  const loader = useRef(load)

  useEffect(() => {
    loader.current = load
  })

  useEffect(() => {
    let latest = 0
    let stopped = false

    function update(): void {
      const run = ++latest

      if (!enablePreview()) {
        setPreviewed(undefined)

        return
      }

      void loader.current().then((result) => {
        if (!stopped && run === latest)
          setPreviewed({ from: data, data: result })
      })
    }

    update()

    const stop = onPreviewChange(update)

    return () => {
      stopped = true
      stop()
    }
  }, [data])

  return previewed?.from === data ? previewed.data : data
}
