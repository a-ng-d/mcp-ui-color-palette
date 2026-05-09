import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import type { Env, Props } from './types'
import { registerPaletteTools } from './tools/palette'
import { registerCommunityTools } from './tools/community'

// ─── MCP Agent ────────────────────────────────────────────────────────────────

export class UICPMcp extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: 'ui-color-palette',
    version: '1.0.0',
  })

  private _accessToken?: string

  async setName(name: string, props?: Record<string, unknown>) {
    const token = (props as Props | undefined)?.accessToken
    if (token) {
      this._accessToken = token
      await this.ctx.storage.put('accessToken', token)
    }
    return super.setName(name, props)
  }

  async onStart(props?: Props) {
    if (props?.accessToken) {
      this._accessToken = props.accessToken
      await this.ctx.storage.put('accessToken', props.accessToken)
    } else {
      this._accessToken = (await this.ctx.storage.get<string>('accessToken')) ?? undefined
    }
    await super.onStart(props)
  }

  async onConnect(conn: unknown, connCtx: { request: Request }) {
    const authHeader = connCtx.request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    if (token) {
      this._accessToken = token
      await this.ctx.storage.put('accessToken', token)
    }
    return super.onConnect(conn as never, connCtx)
  }

  async init() {
    registerPaletteTools(this.server, this.env.API_URL)
    registerCommunityTools(this.server, this.env.API_URL, () => this._accessToken)
  }
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

      const supabaseRes = await fetch(`${env.OAUTH_SERVER_URL}/auth/v1/oauth/clients/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
        body: JSON.stringify(regBody),
      })

      const responseText = await supabaseRes.text()

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

      const ctxWithProps = Object.assign(Object.create(ctx as object), {
        props: token ? ({ accessToken: token } satisfies Props) : undefined,
      }) as ExecutionContext
      return UICPMcp.serve('/mcp').fetch(request, env, ctxWithProps)
    }

    return new Response('Not found', { status: 404 })
  },
}
