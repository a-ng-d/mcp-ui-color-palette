import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { z } from 'zod'

interface Env {
  API_URL: string
  OAUTH_SERVER_URL: string
  SUPABASE_ANON_KEY: string
  MCP_OBJECT: DurableObjectNamespace
}

interface Props extends Record<string, unknown> {
  accessToken?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireAuth(token: string | undefined): { content: Array<{ type: 'text'; text: string }>; isError: true } | null {
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

async function apiCall(
  apiUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string; params?: URLSearchParams } = {},
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
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

// ─── Shared Schemas ───────────────────────────────────────────────────────────

const zRgb = z
  .object({
    r: z.number().min(0).max(1).describe('Red channel, normalized 0.0–1.0 (divide 0-255 value by 255)'),
    g: z.number().min(0).max(1).describe('Green channel, normalized 0.0–1.0 (divide 0-255 value by 255)'),
    b: z.number().min(0).max(1).describe('Blue channel, normalized 0.0–1.0 (divide 0-255 value by 255)'),
    a: z.number().min(0).max(1).optional().describe('Alpha channel, normalized 0.0–1.0 (optional)'),
  })
  .describe('RGB color as a normalized object {r, g, b} with values 0.0–1.0 — NOT an array, NOT 0-255 integers')

const zHex = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, 'Must be a valid hex color string')
  .describe('Hex color string (e.g. "#FFFFFF", "#fff", "#FF000080")')

const zRef = z
  .string()
  .regex(/^[^:]+:[^:]+$/, 'Must be in the format "colorId:shadeName"')
  .describe('Primitive ref in the format "colorId:shadeName" (e.g. "blue:500")')


const zPreset = z.object({
  id: z.string().min(1).describe('Preset identifier, e.g. "MATERIAL", "TAILWIND", "MATERIAL_3", "ANT"'),
  name: z.string().min(1).describe('Human-readable preset name'),
  stops: z
    .array(z.number().int().min(0))
    .min(1)
    .describe('Ordered list of shade stops as positive integers, e.g. [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]'),
  min: z.number().min(0).max(100).describe('Minimum lightness percentage for the scale, 0–100 (e.g. 24)'),
  max: z.number().min(0).max(100).describe('Maximum lightness percentage for the scale, 0–100 (e.g. 96)'),

  easing: z
    .enum([
      'NONE',
      'LINEAR',
      'EASEIN_SINE',
      'EASEOUT_SINE',
      'EASEINOUT_SINE',
      'EASEIN_QUAD',
      'EASEOUT_QUAD',
      'EASEINOUT_QUAD',
      'EASEIN_CUBIC',
      'EASEOUT_CUBIC',
      'EASEINOUT_CUBIC',
    ])
    .describe('Easing curve applied to lightness distribution across stops'),
  family: z.string().optional().describe('Optional preset family label (e.g. "Google", "Framework")'),
})

const zColor = z.object({
  id: z.string().optional().describe('Unique identifier for the color — generate a random 11-character lowercase hex string (e.g. "4a7f2c1e09b"). Used in refs as "colorId:shadeName" so must stay consistent within the same request'),

  name: z.string().min(1).describe('Display name for the color'),
  description: z.string().optional().describe('Optional description, use empty string if none'),
  rgb: zRgb,
  hue: z
    .object({ shift: z.number().min(-360).max(360), isLocked: z.boolean() })
    .describe('Hue shift in degrees (−360–360) — use {shift: 0, isLocked: false} for no adjustment'),
  chroma: z
    .object({ shift: z.number().min(-100).max(100), isLocked: z.boolean() })
    .describe('Chroma/saturation shift (−100–100) — use {shift: 0, isLocked: false} for no adjustment'),
  alpha: z
    .object({ isEnabled: z.boolean(), backgroundColor: zHex })
    .describe('Alpha config — use {isEnabled: false, backgroundColor: "#FFFFFF"} unless transparency is needed'),
})

const zBase = z.object({
  name: z.string().optional().describe('Palette name'),
  description: z.string().optional().describe('Palette description'),
  preset: zPreset,
  shift: z
    .object({
      chroma: z.number().describe('Global chroma/saturation shift applied to all colors'),
      hue: z.number().describe('Global hue shift applied to all colors'),
    })
    .describe('Global shift adjustments (use {chroma: 0, hue: 0} for no shift)'),
  areSourceColorsLocked: z.boolean().optional().describe('Whether source colors are locked (default: false)'),
  colors: z.array(zColor).min(1).describe('Source colors to generate shades from (at least one required)'),
  colorSpace: z
    .enum(['LCH', 'OKLCH', 'LAB', 'OKLAB', 'HSL', 'HSLUV', 'HSV', 'CMYK', 'RGB', 'HEX', 'P3'])
    .describe('Color space used for shade interpolation (default: "LCH")'),
  algorithmVersion: z.enum(['v1', 'v2', 'v3']).describe('Algorithm version (use "v3" for best results)'),
})

const zTheme = z.object({
  id: z.string().optional().describe('Theme identifier — generate a random 11-character lowercase hex string (e.g. "9e3d5b0f12a")'),  

  name: z.string().min(1).describe('Theme name (e.g. "Light", "Dark")'),
  description: z.string().optional().describe('Theme description, use empty string if none'),
  scale: z
    .record(z.string(), z.number().min(0).max(100))
    .optional()
    .describe(
      'Lightness scale: maps each stop name (string) to a lightness percentage (number). ' +
        'If omitted, a linear scale is auto-generated from the preset stops/min/max. ' +
        'Example for MATERIAL: {"50": 96, "100": 88, "200": 80, "300": 70, "400": 60, "500": 50, "600": 41, "700": 33, "800": 26, "900": 24}.',
    ),
  visionSimulationMode: z
    .enum([
      'NONE',
      'PROTANOMALY',
      'PROTANOPIA',
      'DEUTERANOMALY',
      'DEUTERANOPIA',
      'TRITANOMALY',
      'TRITANOPIA',
      'ACHROMATOMALY',
      'ACHROMATOPSIA',
    ])
    .optional()
    .describe('Color vision deficiency simulation — use "NONE" unless specifically needed'),
  textColorsTheme: z
    .object({ lightColor: zHex, darkColor: zHex })
    .optional()
    .describe('Text colors used for contrast display — use {lightColor: "#FFFFFF", darkColor: "#000000"} by default'),
  paletteBackground: zHex.optional().describe('Hex background color for the palette canvas — use "#FFFFFF" by default'),
  isEnabled: z.boolean().optional().describe('Whether this theme is active — use true'),
  type: z.enum(['default theme', 'custom theme']).optional().describe('Theme type — use "default theme" unless it is a custom override'),
})

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
    const apiUrl = this.env.API_URL
    const getToken = () => this._accessToken

    // ── Palette Generation ──────────────────────────────────────────────

    this.server.registerTool(
      'get_palette',
      {
        description:
          'Generate a complete color palette from base configuration and theme configurations. Returns a flat array of shade rows by default (compact mode).\n\nBy default (`compact: true`), returns a flat array — one object per shade — with only `theme`, `color`, `shade`, `hex`, `contrast`, and `textContrast`. This is the preferred format for all agent tasks (audit, preview, design handoff, summaries).\n\nSet `compact: false` only when raw color space values (rgb, lch, oklch, hsl, etc.) are explicitly required.',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          base: zBase,
          themes: z.array(zTheme).min(1).describe('Array of theme configurations (at least one required, e.g. a "Light" default theme)'),
          compact: z
            .boolean()
            .optional()
            .describe(
              'When true (default), returns a flat array of shade rows with only `theme`, `color`, `shade`, `hex`, `contrast`, and `textContrast`. All raw color space values (rgb, gl, lch, oklch, lab, oklab, hsl, hsluv, hsv, cmyk) are omitted. Set to false only when raw color values are explicitly needed.',
            ),
        },
      },
      async ({ base, themes, compact }) => apiCall(apiUrl, '/get-palette', { body: { base, themes, compact: compact ?? true } }),
    )

    this.server.registerTool(
      'get_color_system',
      {
        description:
          'Build a semantic color system (SystemData) by resolving taxonomy bindings against a generated palette. Returns a SystemData object with all tokens and their per-theme primitive refs.',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          base: zBase,
          themes: z.array(zTheme).min(1).describe('Array of theme configurations (at least one required, e.g. a "Light" default theme)'),
          system: z
            .object({
              schema: z
                .object({
                  groups: z
                    .array(
                      z.object({
                        id: z.string().min(1).describe('Unique identifier for the taxonomy group — generate a random 11-character lowercase hex string (e.g. "4a7f2c1e09b")'),
                        name: z.string().min(1).describe('Display name of the group'),
                        members: z
                          .array(
                            z.object({
                              id: z.string().min(1).describe('Unique identifier for the member — generate a random 11-character lowercase hex string (e.g. "9e3d5b0f12a"). Referenced in bindings path arrays, so must stay consistent within the same request'),
                              name: z.string().min(1).describe('Display name of the member'),
                            }),
                          )
                          .min(1)
                          .describe('Members belonging to this group (at least one required)'),
                      }),
                    )
                    .min(1)
                    .describe('Taxonomy groups that form the cartesian product of semantic token paths (at least one required)'),
                })
                .describe('Taxonomy schema defining the structure of the color system'),
              bindings: z
                .array(
                  z.object({
                    path: z
                      .array(z.string().min(1))
                      .min(1)
                      .describe('Ordered member ids identifying the token (one per group, at least one)'),
                    description: z.string().optional().describe('Optional description for the token'),
                    ref: zRef.describe('Default primitive ref in the format "colorId:shadeName" (e.g. "blue:500")'),
                    overrides: z
                      .record(z.string(), zRef)
                      .optional()
                      .describe('Per-theme overrides mapping themeId to a different "colorId:shadeName" ref'),
                    isExcluded: z
                      .boolean()
                      .optional()
                      .describe('When true the token is present in the output but excluded from code generation'),
                  }),
                )
                .optional()
                .describe('Bindings mapping taxonomy paths to primitive color refs'),
            })
            .describe('System configuration with taxonomy schema and optional bindings'),
        },
      },
      async (args) => apiCall(apiUrl, '/get-color-system', { body: args }),
    )

    this.server.registerTool(
      'create_color_harmony',
      {
        description: 'Create color harmonies (complementary, analogous, triadic, tetradic, compound, square) from a base color',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          baseColor: z
            .tuple([z.number().int().min(0).max(255), z.number().int().min(0).max(255), z.number().int().min(0).max(255)])
            .describe('The base color as an RGB tuple [r, g, b] with integer values 0–255'),

          analogousSpread: z
            .number()
            .min(0)
            .max(180)
            .optional()
            .describe('Spread angle in degrees for analogous harmonies (default: 30, range: 0–180)'),
          returnFormat: z.enum(['rgb', 'hex', 'both']).optional().describe('Return format for generated colors (default: both)'),
          type: z
            .enum(['ALL', 'COMPLEMENTARY', 'ANALOGOUS', 'TRIADIC', 'TETRADIC', 'SQUARE', 'COMPOUND'])
            .optional()
            .describe('Specific harmony type to generate, or "ALL" for all harmony types (default: ALL)'),
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
          imageUrl: z.string().url().describe('Publicly accessible URL of a JPEG or PNG image to extract colors from'),
          colorCount: z.number().int().min(1).max(16).optional().describe('Number of dominant colors to extract (default: 5, range: 1–16)'),
          maxIterations: z
            .number()
            .int()
            .min(1)
            .max(500)
            .optional()
            .describe('Maximum iterations for k-means clustering (default: 50, range: 1–500)'),
          tolerance: z
            .number()
            .min(0)
            .max(100)
            .optional()
            .describe('Convergence tolerance for clustering — lower = more precise, higher = faster (default: 1, range: 0–100)'),
          skipTransparent: z.boolean().optional().describe('Whether to skip transparent pixels when extracting colors (default: true)'),
        },
      },
      async (args) => apiCall(apiUrl, '/extract-dominant-colors', { body: args }),
    )

    this.server.registerTool(
      'generate_code',
      {
        description: 'Generate code tokens or design system variables from base and theme configurations in various formats',
        annotations: {
          readOnlyHint: true,
        },
        inputSchema: {
          base: zBase,
          themes: z.array(zTheme).min(1).describe('Array of theme configurations (at least one required, e.g. a "Light" default theme)'),
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
            .enum(['RGB', 'LCH', 'OKLCH', 'LAB', 'OKLAB', 'HSL', 'HSLUV', 'HSV', 'CMYK', 'HEX', 'P3'])
            .optional()
            .describe('Color space for output values (default: RGB)'),
          system: z
            .object({
              schema: z
                .object({
                  groups: z
                    .array(
                      z.object({
                        id: z.string().min(1).describe('Unique identifier for the taxonomy group — generate a random 11-character lowercase hex string (e.g. "4a7f2c1e09b")'),
                        name: z.string().min(1).describe('Display name of the group'),
                        members: z
                          .array(
                            z.object({
                              id: z.string().min(1).describe('Unique identifier for the member — generate a random 11-character lowercase hex string (e.g. "9e3d5b0f12a"). Referenced in bindings path arrays, so must stay consistent within the same request'),
                              name: z.string().min(1).describe('Display name of the member'),
                            }),
                          )
                          .min(1)
                          .describe('Members belonging to this group (at least one required)'),
                      }),
                    )
                    .min(1)
                    .describe('Taxonomy groups forming the cartesian product of semantic token paths (at least one required)'),
                })
                .describe('Taxonomy schema defining the structure of the color system'),
              bindings: z
                .array(
                  z.object({
                    path: z
                      .array(z.string().min(1))
                      .min(1)
                      .describe('Ordered member ids identifying the token (one per group, at least one)'),
                    description: z.string().optional().describe('Optional description for the token'),
                    ref: zRef.describe('Default primitive ref in the format "colorId:shadeName" (e.g. "blue:500")'),
                    overrides: z
                      .record(z.string(), zRef)
                      .optional()
                      .describe('Per-theme overrides mapping themeId to a different "colorId:shadeName" ref'),
                    isExcluded: z
                      .boolean()
                      .optional()
                      .describe('When true the token is present in the output but excluded from code generation'),
                  }),
                )
                .optional()
                .describe('Bindings mapping taxonomy paths to primitive color refs'),
            })
            .optional()
            .describe(
              'Optional color system configuration. When provided, a semantics file is generated alongside the primitives file, with semantic tokens referencing the primitive shades.',
            ),
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
            .min(1)
            .max(500)
            .trim()
            .describe(
              'Natural language description of the desired color palette, max 500 characters (e.g. "a warm sunset palette with oranges and pinks")',
            ),
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
        const token = getToken()
        const authError = requireAuth(token)
        if (authError) return authError
        const params = new URLSearchParams()
        if (args.page != null) params.set('page', String(args.page))
        if (args.limit != null) params.set('limit', String(args.limit))
        if (args.search) params.set('search', args.search)
        return apiCall(apiUrl, '/list-my-published-palettes', { method: 'GET', token, params })
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
          name: z.string().min(1).describe('Name of the palette'),
          description: z.string().optional().describe('Optional description of the palette'),
          preset: zPreset,
          shift: z
            .object({
              chroma: z.number().describe('Global chroma/saturation shift applied to all colors'),
              hue: z.number().describe('Global hue shift applied to all colors'),
            })
            .describe('Global shift adjustments (use {chroma: 0, hue: 0} for no shift)'),
          are_source_colors_locked: z.boolean().optional().describe('Whether source colors are locked (default: false)'),
          colors: z.array(zColor).min(1).describe('Source colors to generate shades from (at least one required)'),
          themes: z.array(zTheme).min(1).describe('Array of theme configurations (at least one required, e.g. a "Light" default theme)'),
          color_space: z
            .enum(['LCH', 'OKLCH', 'LAB', 'OKLAB', 'HSL', 'HSLUV', 'HSV', 'CMYK', 'RGB', 'HEX', 'P3'])
            .describe('Color space used for shade interpolation (default: "LCH")'),
          algorithm_version: z.enum(['v1', 'v2', 'v3']).describe('Algorithm version (use "v3" for best results)'),
          is_shared: z.boolean().optional().describe('Whether the palette is publicly visible (default: false)'),
        },
      },
      async (body) => {
        const token = getToken()
        const authError = requireAuth(token)
        if (authError) return authError
        return apiCall(apiUrl, '/publish-palette', { body, token })
      },
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
      async ({ paletteId }) => {
        const token = getToken()
        const authError = requireAuth(token)
        if (authError) return authError
        return apiCall(apiUrl, `/share-published-palette/${paletteId}`, { token })
      },
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
      async ({ paletteId }) => {
        const token = getToken()
        const authError = requireAuth(token)
        if (authError) return authError
        return apiCall(apiUrl, `/unpublish-palette/${paletteId}`, { method: 'DELETE', token })
      },
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
      async ({ paletteId }) => {
        const token = getToken()
        const authError = requireAuth(token)
        if (authError) return authError
        return apiCall(apiUrl, `/unshare-published-palette/${paletteId}`, { token })
      },
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
      async ({ paletteId, ...body }) => {
        const token = getToken()
        const authError = requireAuth(token)
        if (authError) return authError
        return apiCall(apiUrl, `/update-published-palette/${paletteId}`, { body, token })
      },
    )
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
