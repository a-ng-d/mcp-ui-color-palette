import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiCall } from '../helpers'
import { zBase, zTheme, zSystemSchema, zBindings } from '../schemas'

export const registerPaletteTools = (server: McpServer, apiUrl: string): void => {
  server.registerTool(
    'get_palette',
    {
      description:
        'Generate a complete color palette from base configuration and theme configurations. Returns a flat array of shade rows by default (compact mode).\n\nBy default (`compact: true`), returns a flat array — one object per shade — with only `theme`, `color`, `shade`, `hex`, `contrast`, and `textContrast`. This is the preferred format for all agent tasks (audit, preview, design handoff, summaries).\n\nSet `compact: false` only when raw color space values (rgb, lch, oklch, hsl, etc.) are explicitly required.',
      annotations: {
        title: 'Generate Color Palette',
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

  server.registerTool(
    'get_color_system',
    {
      description:
        'Build a semantic color system (SystemData) by resolving taxonomy bindings against a generated palette. Returns a SystemData object with all tokens and their per-theme primitive refs.',
      annotations: {
        title: 'Build Color System',
        readOnlyHint: true,
      },
      inputSchema: {
        base: zBase,
        themes: z.array(zTheme).min(1).describe('Array of theme configurations (at least one required, e.g. a "Light" default theme)'),
        system: z
          .object({
            schema: zSystemSchema.describe('Taxonomy schema defining the structure of the color system'),
            bindings: zBindings,
          })
          .describe('System configuration with taxonomy schema and optional bindings'),
      },
    },
    async (args) => apiCall(apiUrl, '/get-color-system', { body: args }),
  )

  server.registerTool(
    'create_color_harmony',
    {
      description: 'Create color harmonies (complementary, analogous, triadic, tetradic, compound, square) from a base color',
      annotations: {
        title: 'Create Color Harmony',
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

  server.registerTool(
    'extract_dominant_colors',
    {
      description: 'Extract the dominant colors from an image using k-means clustering. Supports JPEG and PNG images.',
      annotations: {
        title: 'Extract Dominant Colors',
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

  server.registerTool(
    'generate_code',
    {
      description: 'Generate code tokens or design system variables from base and theme configurations in various formats',
      annotations: {
        title: 'Generate Design Tokens',
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
            schema: zSystemSchema.describe('Taxonomy schema defining the structure of the color system'),
            bindings: zBindings,
          })
          .optional()
          .describe(
            'Optional color system configuration. When provided, a semantics file is generated alongside the primitives file, with semantic tokens referencing the primitive shades.',
          ),
      },
    },
    async (args) => apiCall(apiUrl, '/generate-code', { body: args }),
  )

  server.registerTool(
    'generate_colors_from_prompt',
    {
      description: 'Generate a color palette from a natural language description using AI (Mistral)',
      annotations: {
        title: 'Generate Colors from Prompt',
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

  server.registerTool(
    'preview_palette',
    {
      description:
        'Build a preview image URL for a compact palette and return it as a markdown image link. Call this after get_palette (compact: true) to give the user an instant visual preview. The link renders as an inline image in all major chat UIs (ChatGPT, Mistral, Claude, etc.).',
      annotations: {
        title: 'Preview Palette',
        readOnlyHint: true,
      },
      inputSchema: {
        cells: z
          .array(
            z.object({
              theme: z.string().describe('Theme name'),
              color: z.string().describe('Color name'),
              shade: z.string().describe('Shade name (e.g. "500")'),
              hex: z.string().describe('Hex color value (e.g. "#1a2b3c")'),
            }),
          )
          .min(1)
          .describe(
            'Compact palette cells from get_palette (compact: true). Each cell is one shade of one color in one theme. Only theme, color, shade, and hex fields are used — all other fields are ignored.',
          ),
      },
    },
    ({ cells }) => {
      // Compact format: `<theme>~<color>~<shade>:<hex6>,<shade>:<hex6>;...|-theme2~...`
      const byTheme = new Map<string, Map<string, Array<{ shade: string; hex: string }>>>()
      for (const { theme, color, shade, hex } of cells) {
        if (!byTheme.has(theme)) byTheme.set(theme, new Map())
        const byColor = byTheme.get(theme)!
        if (!byColor.has(color)) byColor.set(color, [])
        byColor.get(color)!.push({ shade, hex: hex.replace(/^#/, '') })
      }
      const data = [...byTheme.entries()]
        .map(
          ([theme, byColor]) =>
            `${encodeURIComponent(theme)}~` +
            [...byColor.entries()]
              .map(
                ([color, shades]) =>
                  `${encodeURIComponent(color)}~` +
                  shades.map(({ shade, hex }) => `${encodeURIComponent(shade)}:${hex}`).join(','),
              )
              .join(';'),
        )
        .join('|')
      const url = `${apiUrl}/v1/preview?data=${data}`
      return {
        content: [{ type: 'text' as const, text: `![palette preview](${url})` }],
      }
    },
  )
}
