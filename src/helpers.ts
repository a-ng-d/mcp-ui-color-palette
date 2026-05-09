export type AuthErrorResult = { content: Array<{ type: 'text'; text: string }>; isError: true }
export type ApiCallResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

export function requireAuth(token: string | undefined): AuthErrorResult | null {
  if (token) return null
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: 'Authentication required. Please sign in via OAuth to use this tool.' }),
      },
    ],
    isError: true,
  }
}

export async function apiCall(
  apiUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string; params?: URLSearchParams } = {},
): Promise<ApiCallResult> {
  const { method = 'POST', body, token, params } = options
  const versionedPath = path.startsWith('/v1') ? path : `/v1${path.startsWith('/') ? path : `/${path}`}`
  const url = params ? `${apiUrl}${versionedPath}?${params}` : `${apiUrl}${versionedPath}`
  const headers: Record<string, string> = {}

  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }], isError: !res.ok }
}
