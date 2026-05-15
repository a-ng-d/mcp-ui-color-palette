import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiCall, requireAuth } from '../helpers'
import { zPreset, zColor, zTheme } from '../schemas'

export const registerCommunityTools = (server: McpServer, apiUrl: string, getToken: () => string | undefined): void => {
  server.registerTool(
    'list_published_palettes',
    {
      description: 'List publicly shared color palettes from the community',
      annotations: {
        title: 'List Published Palettes',
        readOnlyHint: true,
      },
      inputSchema: {
        page: z.number().optional().describe('Page number for pagination (default: 1)'),
        limit: z
          .number()
          .optional()
          .describe('Number of results per page, max 50 (default: 20, recommended: 5 — keep low to avoid large payloads)'),

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

  server.registerTool(
    'list_my_published_palettes',
    {
      description: "List the authenticated user's own published palettes",
      annotations: {
        title: 'List My Published Palettes',
        readOnlyHint: true,
      },
      inputSchema: {
        page: z.number().optional().describe('Page number for pagination (default: 1)'),
        limit: z
          .number()
          .optional()
          .describe('Number of results per page, max 50 (default: 20, recommended: 5 — keep low to avoid large payloads)'),

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

  server.registerTool(
    'publish_palette',
    {
      description: 'Publish a new color palette to the database',
      annotations: {
        title: 'Publish Palette',
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

  server.registerTool(
    'get_published_palette',
    {
      description: 'Get a specific publicly shared palette by its ID',
      annotations: {
        title: 'Get Published Palette',
        readOnlyHint: true,
      },
      inputSchema: {
        paletteId: z.string().describe('Unique identifier of the palette'),
      },
    },
    async ({ paletteId }) => apiCall(apiUrl, `/get-published-palette/${paletteId}`, { method: 'GET' }),
  )

  server.registerTool(
    'share_published_palette',
    {
      description: 'Make a published palette publicly visible to the community',
      annotations: {
        title: 'Share Palette',
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

  server.registerTool(
    'unpublish_palette',
    {
      description: 'Permanently delete a published palette from the database',
      annotations: {
        title: 'Delete Palette',
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

  server.registerTool(
    'unshare_published_palette',
    {
      description: 'Make a published palette private (removes it from the public community listing)',
      annotations: {
        title: 'Unshare Palette',
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

  server.registerTool(
    'update_published_palette',
    {
      description: 'Update an existing published palette with new data',
      annotations: {
        title: 'Update Published Palette',
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
