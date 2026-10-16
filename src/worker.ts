import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpHandler } from 'agents/mcp'
import type { Env } from './types'
import { registerPaletteTools } from './tools/palette'
import { registerCommunityTools } from './tools/community'

// ─── MCP Server (stateless) ───────────────────────────────────────────────────

const createServer = (env: Env, token: string | undefined): McpServer => {
  const server = new McpServer({
    name: 'ui-color-palette',
    version: '1.0.0',
  })
  registerPaletteTools(server, env.API_URL)
  registerCommunityTools(server, env.API_URL, () => token)
  return server
}

// ─── Dynamic Client Registration de-duplication ───────────────────────────────

const DCR_CACHE_TTL_SECONDS = 60 * 60 * 24

const hashRegistration = async (body: Record<string, unknown>): Promise<string> => {
  const normalized = JSON.stringify({
    client_name: body.client_name ?? null,
    redirect_uris: Array.isArray(body.redirect_uris) ? [...(body.redirect_uris as string[])].sort() : null,
    grant_types: Array.isArray(body.grant_types) ? [...(body.grant_types as string[])].sort() : null,
    response_types: Array.isArray(body.response_types) ? [...(body.response_types as string[])].sort() : null,
    scope: body.scope ?? null,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Worker Entry Point ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    if (url.pathname === '/.well-known/oauth-authorization-server') {
      const res = await fetch(`${env.OAUTH_SERVER_URL}/.well-known/oauth-authorization-server/auth/v1`)
      const metadata = (await res.json()) as Record<string, unknown>
      metadata.issuer = url.origin
      metadata.token_endpoint = `${url.origin}/oauth/token`
      metadata.registration_endpoint = `${url.origin}/oauth/register`
      return new Response(JSON.stringify(metadata), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname === '/oauth/register' && request.method === 'POST') {
      let regBody: Record<string, unknown> = {}
      try {
        regBody = (await request.json()) as Record<string, unknown>
      } catch {
        // ignore
      }
      regBody.token_endpoint_auth_method = 'none'

      const cache = (caches as unknown as { default: Cache }).default
      const cacheKey = new Request(`${url.origin}/__dcr/${await hashRegistration(regBody)}`)
      const cached = await cache.match(cacheKey)
      if (cached) return cached

      const supabaseRes = await fetch(`${env.OAUTH_SERVER_URL}/auth/v1/oauth/clients/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
        body: JSON.stringify(regBody),
      })

      const responseText = await supabaseRes.text()

      if (supabaseRes.ok) {
        ctx.waitUntil(
          cache.put(
            cacheKey,
            new Response(responseText, {
              status: supabaseRes.status,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${DCR_CACHE_TTL_SECONDS}`,
              },
            }),
          ),
        )
      }

      return new Response(responseText, {
        status: supabaseRes.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname === '/oauth/token' && request.method === 'POST') {
      const body = await request.arrayBuffer()

      const supabaseRes = await fetch(`${env.OAUTH_SERVER_URL}/auth/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': request.headers.get('Content-Type') ?? 'application/x-www-form-urlencoded' },
        body,
      })

      const responseText = await supabaseRes.text()

      if (!supabaseRes.ok) {
        let errBody: Record<string, unknown> = {}
        try {
          errBody = JSON.parse(responseText) as Record<string, unknown>
        } catch {
          // ignore parse failure — fall through with empty errBody
        }
        return new Response(
          JSON.stringify({
            error: String(errBody.error ?? errBody.error_code ?? 'server_error'),
            error_description: String(errBody.error_description ?? errBody.msg ?? 'Unexpected server error'),
          }),
          { status: supabaseRes.status, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(responseText, {
        status: supabaseRes.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname === '/mcp') {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

      try {
        const handler = createMcpHandler(createServer(env, token), {
          route: '/mcp',
          enableJsonResponse: true,
        })
        return await handler(request, env, ctx)
      } catch (error) {
        console.error('MCP request failure', {
          method: request.method,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Service temporarily unavailable, please retry.' },
            id: null,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
          },
        )
      }
    }

    return new Response('Not found', { status: 404 })
  },
}
