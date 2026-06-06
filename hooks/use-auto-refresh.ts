import { useCallback, useEffect, useRef, useState } from 'react'

const THIRTY_MINUTES = 30 * 60 * 1000

export function useAutoRefresh(fetcher: () => Promise<void>, interval = THIRTY_MINUTES) {
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await fetcherRef.current()
      setLastRefreshed(new Date())
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(refresh, interval)
    return () => clearInterval(id)
  }, [refresh, interval])

  return { refresh, lastRefreshed, refreshing }
}
