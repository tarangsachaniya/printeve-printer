const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

function getToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)printer_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

// Best-effort Slack reporting for every failed API call (matches the platform-wide
// "alert on all errors, including 4xx" decision). Never throws, never blocks the caller.
function reportApiFailure(input: { message: string; path: string; method: string; status?: number }): void {
  if (typeof window === 'undefined') return
  fetch('/api/log-error', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: input.message, path: `${input.method} ${input.path}`, status: input.status }),
  }).catch(() => {})
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const method = (init.method ?? 'GET').toUpperCase()

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  } catch (err) {
    reportApiFailure({ message: err instanceof Error ? err.message : 'Network request failed', path, method })
    throw err
  }

  if (res.status === 401) {
    document.cookie = 'printer_token=; Max-Age=0; path=/'
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  const json = await res.json()
  if (!res.ok) {
    const message = json.error ?? 'Request failed'
    reportApiFailure({ message, path, method, status: res.status })
    throw new Error(message)
  }
  return json as T
}

export const api = {
  get:    <T>(path: string) =>
    apiFetch<T>(path),
  post:   <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
}
