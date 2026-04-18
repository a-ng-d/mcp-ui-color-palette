interface Env {
  API_URL: string
}

// ─── MCP Protocol Types ───────────────────────────────────────────────────────

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: McpTool[] = [
  {
    name: 'get_full_palette',
    description:
      'Generate a complete color palette from base configuration and theme configurations. Returns a PaletteData object with all color scales.',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'object',
          description: 'Base configuration for the palette (colors, preset, algorithm settings)',
        },
        themes: {
          type: 'array',
          description: 'Array of theme configurations (light/dark modes, contrast levels)',
          items: { type: 'object' },
        },
      },
      required: ['base', 'themes'],
    },
  },
  {
    name: 'create_color_harmony',
    description: 'Create color harmonies (complementary, analogous, triadic, tetradic, split-complementary, square) from a base color',
    inputSchema: {
      type: 'object',
      properties: {
        baseColor: {
          type: 'object',
          description: 'The base color as a Channel object with hue, saturation, and lightness values',
        },
        analogousSpread: {
          type: 'number',
          description: 'Spread angle in degrees for analogous harmonies (optional)',
        },
        returnFormat: {
          type: 'string',
          enum: ['rgb', 'hex', 'both'],
          description: 'Return format for generated colors (default: both)',
        },
        type: {
          type: 'string',
          description: 'Specific harmony type to generate, or "ALL" for all harmony types',
          enum: ['ALL', 'COMPLEMENTARY', 'SPLIT_COMPLEMENTARY', 'ANALOGOUS', 'TRIADIC', 'TETRADIC', 'SQUARE'],
        },
      },
      required: ['baseColor'],
    },
  },
  {
    name: 'extract_dominant_colors',
    description: 'Extract the dominant colors from an image using k-means clustering. Supports JPEG and PNG images.',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'Public URL of the JPEG or PNG image to extract colors from',
        },
        colorCount: {
          type: 'number',
          description: 'Number of dominant colors to extract (optional)',
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum iterations for k-means clustering (optional)',
        },
        tolerance: {
          type: 'number',
          description: 'Convergence tolerance for clustering (optional)',
        },
        skipTransparent: {
          type: 'boolean',
          description: 'Whether to skip transparent pixels (optional)',
        },
      },
      required: ['imageUrl'],
    },
  },
  {
    name: 'generate_code',
    description: 'Generate code tokens or design system variables from palette data in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        paletteData: {
          type: 'object',
          description: 'The PaletteData object returned by get_full_palette',
        },
        format: {
          type: 'string',
          description: 'Output format for generated code (default: css)',
          enum: [
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
          ],
        },
        colorSpace: {
          type: 'string',
          description: 'Color space for output values (optional, default: RGB)',
          enum: ['RGB', 'LCH', 'LAB', 'HSL', 'OKLCH', 'OKLAB', 'P3'],
        },
      },
      required: ['paletteData'],
    },
  },
  {
    name: 'generate_colors_from_prompt',
    description: 'Generate a color palette from a natural language description using AI (Mistral)',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Natural language description of the desired color palette (e.g. "a warm sunset palette with oranges and pinks")',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'start_authentication',
    description:
      'Start the passkey authentication flow. Returns an auth URL the user must open in their browser. After completing authentication, use the returned tokens for authorized requests.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_published_palettes',
    description: 'List publicly shared color palettes from the community',
    inputSchema: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Number of results per page, max 50 (default: 20)',
        },
        search: {
          type: 'string',
          description: 'Search term to filter palettes by name',
        },
      },
    },
  },
  {
    name: 'list_my_published_palettes',
    description: "List the authenticated user's own published palettes",
    inputSchema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT access token obtained from start_authentication',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Number of results per page, max 50 (default: 20)',
        },
        search: {
          type: 'string',
          description: 'Search term to filter palettes by name',
        },
      },
      required: ['accessToken'],
    },
  },
  {
    name: 'publish_palette',
    description: 'Publish a new color palette to the database',
    inputSchema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT access token obtained from start_authentication',
        },
        name: {
          type: 'string',
          description: 'Name of the palette',
        },
        description: {
          type: 'string',
          description: 'Optional description of the palette',
        },
        preset: {
          type: 'object',
          description: 'Preset configuration used by the palette',
        },
        shift: {
          type: 'object',
          description: 'Shift configuration for color adjustments',
        },
        are_source_colors_locked: {
          type: 'boolean',
          description: 'Whether the source colors are locked from modification',
        },
        colors: {
          type: 'array',
          description: 'Array of source color definitions',
        },
        themes: {
          type: 'array',
          description: 'Array of theme configurations',
        },
        color_space: {
          type: 'string',
          description: 'Color space used for the palette',
        },
        algorithm_version: {
          type: 'string',
          description: 'Version of the palette generation algorithm',
        },
        is_shared: {
          type: 'boolean',
          description: 'Whether the palette is publicly visible (default: false)',
        },
      },
      required: [
        'accessToken',
        'name',
        'preset',
        'shift',
        'are_source_colors_locked',
        'colors',
        'themes',
        'color_space',
        'algorithm_version',
      ],
    },
  },
  {
    name: 'get_published_palette',
    description: 'Get a specific publicly shared palette by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        paletteId: {
          type: 'string',
          description: 'Unique identifier of the palette',
        },
      },
      required: ['paletteId'],
    },
  },
  {
    name: 'share_published_palette',
    description: 'Make a published palette publicly visible to the community',
    inputSchema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT access token obtained from start_authentication',
        },
        paletteId: {
          type: 'string',
          description: 'Unique identifier of the palette to share',
        },
      },
      required: ['accessToken', 'paletteId'],
    },
  },
  {
    name: 'unpublish_palette',
    description: 'Permanently delete a published palette from the database',
    inputSchema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT access token obtained from start_authentication',
        },
        paletteId: {
          type: 'string',
          description: 'Unique identifier of the palette to delete',
        },
      },
      required: ['accessToken', 'paletteId'],
    },
  },
  {
    name: 'unshare_published_palette',
    description: 'Make a published palette private (removes it from the public community listing)',
    inputSchema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT access token obtained from start_authentication',
        },
        paletteId: {
          type: 'string',
          description: 'Unique identifier of the palette to unshare',
        },
      },
      required: ['accessToken', 'paletteId'],
    },
  },
  {
    name: 'update_published_palette',
    description: 'Update an existing published palette with new data',
    inputSchema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT access token obtained from start_authentication',
        },
        paletteId: {
          type: 'string',
          description: 'Unique identifier of the palette to update',
        },
        name: {
          type: 'string',
          description: 'Updated name',
        },
        description: {
          type: 'string',
          description: 'Updated description',
        },
        preset: {
          type: 'object',
          description: 'Updated preset configuration',
        },
        shift: {
          type: 'object',
          description: 'Updated shift configuration',
        },
        are_source_colors_locked: {
          type: 'boolean',
          description: 'Updated lock state for source colors',
        },
        colors: {
          type: 'array',
          description: 'Updated array of color definitions',
        },
        themes: {
          type: 'array',
          description: 'Updated array of theme configurations',
        },
        color_space: {
          type: 'string',
          description: 'Updated color space',
        },
        algorithm_version: {
          type: 'string',
          description: 'Updated algorithm version',
        },
        is_shared: {
          type: 'boolean',
          description: 'Updated sharing visibility',
        },
      },
      required: ['accessToken', 'paletteId'],
    },
  },
]

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>, apiUrl: string): Promise<ToolCallResult> {
  try {
    switch (name) {
      case 'get_full_palette': {
        const res = await fetch(`${apiUrl}/get-full-palette`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base: args.base, themes: args.themes }),
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'create_color_harmony': {
        const res = await fetch(`${apiUrl}/create-color-harmony`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'extract_dominant_colors': {
        const res = await fetch(`${apiUrl}/extract-dominant-colors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: args.imageUrl,
            colorCount: args.colorCount,
            maxIterations: args.maxIterations,
            tolerance: args.tolerance,
            skipTransparent: args.skipTransparent,
          }),
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'generate_code': {
        const res = await fetch(`${apiUrl}/generate-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'generate_colors_from_prompt': {
        const res = await fetch(`${apiUrl}/generate-colors-from-prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: args.prompt }),
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'start_authentication': {
        const res = await fetch(`${apiUrl}/authenticate`, { method: 'GET' })

        if (!res.ok || !res.body) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ message: `Authentication request failed: ${res.status}` }) }],
            isError: true,
          }
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const event = JSON.parse(line.slice(6)) as Record<string, unknown>
                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify(
                        {
                          ...event,
                          message:
                            event.message ??
                            'Open the auth_url in your browser to authenticate. Once complete, use the returned tokens for authorized tool calls.',
                        },
                        null,
                        2,
                      ),
                    },
                  ],
                }
              }
            }
          }
        } finally {
          reader.cancel()
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({ message: 'No authentication event received' }) }],
          isError: true,
        }
      }

      case 'list_published_palettes': {
        const params = new URLSearchParams()
        if (args.page != null) params.set('page', String(args.page))
        if (args.limit != null) params.set('limit', String(args.limit))
        if (args.search) params.set('search', String(args.search))
        const res = await fetch(`${apiUrl}/list-published-palettes?${params}`, { method: 'GET' })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'list_my_published_palettes': {
        const params = new URLSearchParams()
        if (args.page != null) params.set('page', String(args.page))
        if (args.limit != null) params.set('limit', String(args.limit))
        if (args.search) params.set('search', String(args.search))
        const res = await fetch(`${apiUrl}/list-my-published-palettes?${params}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${args.accessToken}` },
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'publish_palette': {
        const { accessToken, ...body } = args
        const res = await fetch(`${apiUrl}/publish-palette`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'get_published_palette': {
        const res = await fetch(`${apiUrl}/get-published-palette/${args.paletteId}`, { method: 'GET' })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'share_published_palette': {
        const res = await fetch(`${apiUrl}/share-published-palette/${args.paletteId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${args.accessToken}` },
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'unpublish_palette': {
        const res = await fetch(`${apiUrl}/unpublish-palette/${args.paletteId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${args.accessToken}` },
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'unshare_published_palette': {
        const res = await fetch(`${apiUrl}/unshare-published-palette/${args.paletteId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${args.accessToken}` },
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      case 'update_published_palette': {
        const { accessToken, paletteId, ...body } = args
        const res = await fetch(`${apiUrl}/update-published-palette/${paletteId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: !res.ok }
      }

      default:
        return {
          content: [{ type: 'text', text: JSON.stringify({ message: `Unknown tool: ${name}` }) }],
          isError: true,
        }
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ message: String(error) }) }],
      isError: true,
    }
  }
}

// ─── MCP Message Handler ──────────────────────────────────────────────────────

async function handleMessage(message: JsonRpcMessage, apiUrl: string): Promise<JsonRpcMessage | null> {
  const id = message.id ?? null

  if (!message.method) {
    return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request: missing method' } }
  }

  try {
    switch (message.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'ui-color-palette', version: '1.0.0' },
            capabilities: { tools: {} },
          },
        }

      case 'notifications/initialized':
        return null

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} }

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } }

      case 'tools/call': {
        const params = message.params as { name: string; arguments?: Record<string, unknown> }
        if (!params?.name) {
          return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params: missing tool name' } }
        }
        const result = await callTool(params.name, params.arguments ?? {}, apiUrl)
        return { jsonrpc: '2.0', id, result }
      }

      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${message.method}` } }
    }
  } catch (error) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: String(error) } }
  }
}

// ─── Worker Entry Point ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Only POST requests are accepted' }, id: null }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: invalid JSON' }, id: null }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiUrl = env.API_URL

    if (Array.isArray(body)) {
      const responses = await Promise.all((body as JsonRpcMessage[]).map((msg) => handleMessage(msg, apiUrl)))
      const nonNull = responses.filter((r): r is JsonRpcMessage => r !== null)
      return new Response(JSON.stringify(nonNull), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const response = await handleMessage(body as JsonRpcMessage, apiUrl)

    if (response === null) {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  },
}
