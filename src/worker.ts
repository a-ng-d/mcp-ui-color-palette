import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { z } from 'zod'

interface Env {
  API_URL: string
  SUPABASE_URL: string
  MCP_OBJECT: DurableObjectNamespace
}

interface Props extends Record<string, unknown> {
  accessToken?: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiCall(
  apiUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string; params?: URLSearchParams } = {},
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const { method = 'POST', body, token, params } = options
  const url = params ? `${apiUrl}${path}?${params}` : `${apiUrl}${path}`
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

// ─── MCP Agent ────────────────────────────────────────────────────────────────

export class UICPMcp extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: 'ui-color-palette',
    version: '1.0.0',
  })

  async init() {
    const apiUrl = this.env.API_URL
    const getToken = () => this.props?.accessToken

    // ── Palette Generation ──────────────────────────────────────────────

    this.server.registerTool(
      'get_full_palette',
      {
        description:
          'Generate a complete color palette from base configuration and theme configurations. Returns a PaletteData object with all color scales.',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          base: z.record(z.string(), z.unknown()).describe('Base configuration for the palette (colors, preset, algorithm settings)'),
          themes: z.array(z.record(z.string(), z.unknown())).describe('Array of theme configurations (light/dark modes, contrast levels)'),
        },
      },
      async ({ base, themes }) => apiCall(apiUrl, '/get-full-palette', { body: { base, themes } }),
    )

    this.server.registerTool(
      'create_color_harmony',
      {
        description: 'Create color harmonies (complementary, analogous, triadic, tetradic, split-complementary, square) from a base color',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          baseColor: z
            .record(z.string(), z.unknown())
            .describe('The base color as a Channel object with hue, saturation, and lightness values'),
          analogousSpread: z.number().optional().describe('Spread angle in degrees for analogous harmonies'),
          returnFormat: z.enum(['rgb', 'hex', 'both']).optional().describe('Return format for generated colors (default: both)'),
          type: z
            .enum(['ALL', 'COMPLEMENTARY', 'SPLIT_COMPLEMENTARY', 'ANALOGOUS', 'TRIADIC', 'TETRADIC', 'SQUARE'])
            .optional()
            .describe('Specific harmony type to generate, or "ALL" for all harmony types'),
        },
      },
      async (args) => apiCall(apiUrl, '/create-color-harmony', { body: args }),
    )

    this.server.registerTool(
      'extract_dominant_colors',
      {
        description: 'Extract the dominant colors from an image using k-means clustering. Supports JPEG and PNG images.',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          imageUrl: z.string().describe('Public URL of the JPEG or PNG image to extract colors from'),
          colorCount: z.number().optional().describe('Number of dominant colors to extract'),
          maxIterations: z.number().optional().describe('Maximum iterations for k-means clustering'),
          tolerance: z.number().optional().describe('Convergence tolerance for clustering'),
          skipTransparent: z.boolean().optional().describe('Whether to skip transparent pixels'),
        },
      },
      async (args) => apiCall(apiUrl, '/extract-dominant-colors', { body: args }),
    )

    this.server.registerTool(
      'generate_code',
      {
        description: 'Generate code tokens or design system variables from palette data in various formats',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          paletteData: z.record(z.string(), z.unknown()).describe('The PaletteData object returned by get_full_palette'),
          format: z
            .enum([
              'css',
              'scss',
              'less',
              'tailwind-v3',
              'tailwind-v4',
              'swift-ui',
              'ui-kit',
              'compose',
              'resources',
              'csv',
              'native-tokens',
              'dtcg-tokens',
              'style-dictionary-v3',
              'universal-json',
            ])
            .optional()
            .describe('Output format for generated code (default: css)'),
          colorSpace: z
            .enum(['RGB', 'LCH', 'LAB', 'HSL', 'OKLCH', 'OKLAB', 'P3'])
            .optional()
            .describe('Color space for output values (default: RGB)'),
        },
      },
      async (args) => apiCall(apiUrl, '/generate-code', { body: args }),
    )

    this.server.registerTool(
      'generate_colors_from_prompt',
      {
        description: 'Generate a color palette from a natural language description using AI (Mistral)',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          prompt: z
            .string()
            .describe('Natural language description of the desired color palette (e.g. "a warm sunset palette with oranges and pinks")'),
        },
      },
      async ({ prompt }) => apiCall(apiUrl, '/generate-colors-from-prompts', { body: { prompt } }),
    )

    // ── Published Palettes ──────────────────────────────────────────────

    this.server.registerTool(
      'list_published_palettes',
      {
        description: 'List publicly shared color palettes from the community',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          page: z.number().optional().describe('Page number for pagination (default: 1)'),
          limit: z.number().optional().describe('Number of results per page, max 50 (default: 20)'),
          search: z.string().optional().describe('Search term to filter palettes by name'),
        },
      },
      async (args) => {
        const params = new URLSearchParams()
        if (args.page != null) params.set('page', String(args.page))
        if (args.limit != null) params.set('limit', String(args.limit))
        if (args.search) params.set('search', args.search)
        return apiCall(apiUrl, '/list-published-palettes', { method: 'GET', params })
      },
    )

    this.server.registerTool(
      'list_my_published_palettes',
      {
        description: "List the authenticated user's own published palettes",
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          page: z.number().optional().describe('Page number for pagination (default: 1)'),
          limit: z.number().optional().describe('Number of results per page, max 50 (default: 20)'),
          search: z.string().optional().describe('Search term to filter palettes by name'),
        },
      },
      async (args) => {
        const params = new URLSearchParams()
        if (args.page != null) params.set('page', String(args.page))
        if (args.limit != null) params.set('limit', String(args.limit))
        if (args.search) params.set('search', args.search)
        return apiCall(apiUrl, '/list-my-published-palettes', { method: 'GET', token: getToken(), params })
      },
    )

    this.server.registerTool(
      'publish_palette',
      {
        description: 'Publish a new color palette to the database',
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
        },
        inputSchema: {
          name: z.string().describe('Name of the palette'),
          description: z.string().optional().describe('Optional description of the palette'),
          preset: z.record(z.string(), z.unknown()).describe('Preset configuration used by the palette'),
          shift: z.record(z.string(), z.unknown()).describe('Shift configuration for color adjustments'),
          are_source_colors_locked: z.boolean().describe('Whether the source colors are locked from modification'),
          colors: z.array(z.record(z.string(), z.unknown())).describe('Array of source color definitions'),
          themes: z.array(z.record(z.string(), z.unknown())).describe('Array of theme configurations'),
          color_space: z.string().describe('Color space used for the palette'),
          algorithm_version: z.string().describe('Version of the palette generation algorithm'),
          is_shared: z.boolean().optional().describe('Whether the palette is publicly visible (default: false)'),
        },
      },
      async (body) => apiCall(apiUrl, '/publish-palette', { body, token: getToken() }),
    )

    this.server.registerTool(
      'get_published_palette',
      {
        description: 'Get a specific publicly shared palette by its ID',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          paletteId: z.string().describe('Unique identifier of the palette'),
        },
      },
      async ({ paletteId }) => apiCall(apiUrl, `/get-published-palette/${paletteId}`, { method: 'GET' }),
    )

    this.server.registerTool(
      'share_published_palette',
      {
        description: 'Make a published palette publicly visible to the community',
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
        inputSchema: {
          paletteId: z.string().describe('Unique identifier of the palette to share'),
        },
      },
      async ({ paletteId }) => apiCall(apiUrl, `/share-published-palette/${paletteId}`, { token: getToken() }),
    )

    this.server.registerTool(
      'unpublish_palette',
      {
        description: 'Permanently delete a published palette from the database',
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
        },
        inputSchema: {
          paletteId: z.string().describe('Unique identifier of the palette to delete'),
        },
      },
      async ({ paletteId }) => apiCall(apiUrl, `/unpublish-palette/${paletteId}`, { method: 'DELETE', token: getToken() }),
    )

    this.server.registerTool(
      'unshare_published_palette',
      {
        description: 'Make a published palette private (removes it from the public community listing)',
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
        inputSchema: {
          paletteId: z.string().describe('Unique identifier of the palette to unshare'),
        },
      },
      async ({ paletteId }) => apiCall(apiUrl, `/unshare-published-palette/${paletteId}`, { token: getToken() }),
    )

    this.server.registerTool(
      'update_published_palette',
      {
        description: 'Update an existing published palette with new data',
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
        },
        inputSchema: {
          paletteId: z.string().describe('Unique identifier of the palette to update'),
          name: z.string().optional().describe('Updated name'),
          description: z.string().optional().describe('Updated description'),
          preset: z.record(z.string(), z.unknown()).optional().describe('Updated preset configuration'),
          shift: z.record(z.string(), z.unknown()).optional().describe('Updated shift configuration'),
          are_source_colors_locked: z.boolean().optional().describe('Updated lock state for source colors'),
          colors: z.array(z.record(z.string(), z.unknown())).optional().describe('Updated array of color definitions'),
          themes: z.array(z.record(z.string(), z.unknown())).optional().describe('Updated array of theme configurations'),
          color_space: z.string().optional().describe('Updated color space'),
          algorithm_version: z.string().optional().describe('Updated algorithm version'),
          is_shared: z.boolean().optional().describe('Updated sharing visibility'),
        },
      },
      async ({ paletteId, ...body }) => apiCall(apiUrl, `/update-published-palette/${paletteId}`, { body, token: getToken() }),
    )
  }
}

// ─── Worker Entry Point ───────────────────────────────────────────────────────

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // OAuth 2.1 discovery — proxy Supabase's authorization server metadata so
    // MCP clients can auto-configure without any manual setup.
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      // Custom auth domain: discovery is at the root (no /auth/v1 suffix)
      return fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/oauth-authorization-server`)
    }

    if (url.pathname === '/mcp') {
      // Extract the Bearer token issued by Supabase OAuth and inject it into
      // ctx.props so McpAgent passes it to the Durable Object via getAgentByName.
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
      if (token) {
        ;(ctx as unknown as { props: Props }).props = { accessToken: token }
      }

      return UICPMcp.serve('/mcp').fetch(request, env, ctx)
    }

    return new Response('Not found', { status: 404 })
  },
}
