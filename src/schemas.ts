import { z } from 'zod'

export const zRgb = z
  .object({
    r: z.number().min(0).max(1).describe('Red channel, normalized 0.0–1.0 (divide 0-255 value by 255)'),
    g: z.number().min(0).max(1).describe('Green channel, normalized 0.0–1.0 (divide 0-255 value by 255)'),
    b: z.number().min(0).max(1).describe('Blue channel, normalized 0.0–1.0 (divide 0-255 value by 255)'),
    a: z.number().min(0).max(1).optional().describe('Alpha channel, normalized 0.0–1.0 (optional)'),
  })
  .describe('RGB color as a normalized object {r, g, b} with values 0.0–1.0 — NOT an array, NOT 0-255 integers')

export const zHex = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, 'Must be a valid hex color string')
  .describe('Hex color string (e.g. "#FFFFFF", "#fff", "#FF000080")')

export const zRef = z
  .string()
  .regex(/^[^:]+:[^:]+$/, 'Must be in the format "colorId:shadeName"')
  .describe('Primitive ref in the format "colorId:shadeName" (e.g. "blue:500")')

export const zPresetId = z.enum([
  'CUSTOM_1_10',
  'CUSTOM_10_100',
  'CUSTOM_100_1000',
  'MATERIAL',
  'MATERIAL_3',
  'TAILWIND',
  'ANT',
  'BOOTSTRAP',
  'RADIX',
  'UNTITLED_UI',
  'OPEN_COLOR',
  'ADS',
  'ADS_NEUTRAL',
  'SPECTRUM',
  'SPECTRUM_NEUTRAL',
  'CARBON',
  'BASE',
  'POLARIS',
  'FLUENT',
]).describe(
  'Preset identifier — must be one of the supported values. ' +
  'Each preset carries canonical stops, min, max, and easing values. ' +
  'Use those canonical values when building the preset object:\n' +
  '  CUSTOM_1_10:       stops [1-6],          min 10, max 90,  easing LINEAR\n' +
  '  CUSTOM_10_100:     stops [10-60],         min 10, max 90,  easing LINEAR\n' +
  '  CUSTOM_100_1000:   stops [100-600],       min 10, max 90,  easing LINEAR\n' +
  '  MATERIAL:          stops [50,100-900],    min 24, max 96,  easing LINEAR\n' +
  '  MATERIAL_3:        stops [100,99,95,90,80,70,60,50,40,30,20,10,0], min 0, max 100, easing NONE\n' +
  '  TAILWIND:          stops [50,100-900,950], min 16, max 96, easing LINEAR\n' +
  '  ANT:               stops [1-10],          min 24, max 96,  easing LINEAR\n' +
  '  BOOTSTRAP:         stops [100-900],       min 15, max 95,  easing LINEAR\n' +
  '  RADIX:             stops [1-12],          min 5,  max 95,  easing LINEAR\n' +
  '  UNTITLED_UI:       stops [25,50,100-900,950], min 5, max 100, easing LINEAR\n' +
  '  OPEN_COLOR:        stops [0-9],           min 15, max 100, easing LINEAR\n' +
  '  ADS:               stops [100-1000],      min 24, max 96,  easing LINEAR\n' +
  '  ADS_NEUTRAL:       stops [0,100-1100],    min 8,  max 100, easing LINEAR\n' +
  '  SPECTRUM:          stops [100-1300],      min 16, max 96,  easing LINEAR\n' +
  '  SPECTRUM_NEUTRAL:  stops [50,75,100-900], min 0,  max 100, easing LINEAR\n' +
  '  CARBON:            stops [10-100 by 10],  min 24, max 96,  easing LINEAR\n' +
  '  BASE:              stops [50,100-700],    min 24, max 96,  easing LINEAR\n' +
  '  POLARIS:           stops [1-16],          min 16, max 100, easing EASEOUT_QUAD\n' +
  '  FLUENT:            stops [10-160 by 10],  min 10, max 90,  easing LINEAR'
)

export const zPreset = z.object({
  id: zPresetId,
  name: z.string().min(1).describe('Human-readable preset name matching the chosen id'),
  stops: z
    .array(z.number().int().min(0))
    .min(1)
    .describe('Ordered list of shade stops — must match the canonical stops for the chosen id (see id description)'),
  min: z.number().min(0).max(100).describe('Minimum lightness percentage — must match the canonical min for the chosen id (see id description)'),
  max: z.number().min(0).max(100).describe('Maximum lightness percentage — must match the canonical max for the chosen id (see id description)'),
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
    .describe('Easing curve — must match the canonical easing for the chosen id (see id description)'),
  family: z.string().optional().describe('Optional preset family label (e.g. "Google", "Framework")'),
})

export const zColor = z.object({
  id: z
    .string()
    .optional()
    .describe(
      'Unique identifier for the color — generate a random 11-character lowercase hex string (e.g. "4a7f2c1e09b"). Used in refs as "colorId:shadeName" so must stay consistent within the same request',
    ),
  name: z.string().min(1).describe('Display name for the color'),
  description: z.string().optional().describe('Optional description, use empty string if none'),
  rgb: zRgb,
  hue: z
    .object({ shift: z.number().min(-360).max(360), isLocked: z.boolean() })
    .describe('Hue shift in degrees (−360–360) — use {shift: 0, isLocked: false} for no adjustment'),
  chroma: z
    .object({ shift: z.number().min(0).max(200), isLocked: z.boolean() })
    .describe('Chroma/saturation shift (0–200) — use {shift: 100, isLocked: false} for no adjustment'),
  alpha: z
    .object({ isEnabled: z.boolean(), backgroundColor: zHex })
    .describe('Alpha config — use {isEnabled: false, backgroundColor: "#FFFFFF"} unless transparency is needed'),
})

export const zBase = z.object({
  name: z.string().optional().describe('Palette name'),
  description: z.string().optional().describe('Palette description'),
  preset: zPreset,
  shift: z
    .object({
      chroma: z
        .number()
        .min(0)
        .max(200)
        .describe('Global chroma/saturation shift applied to all colors - Chroma/saturation shift (0–200) - use 100 for no shift'),
      hue: z
        .number()
        .min(-360)
        .max(360)
        .describe('Global hue shift applied to all colors - Hue shift in degrees (−360–360) - use 0 for no shift'),
    })
    .describe('Global shift adjustments (use {chroma: 100, hue: 0} for no shift)'),
  areSourceColorsLocked: z.boolean().optional().describe('Whether source colors are locked (default: false)'),
  colors: z.array(zColor).min(1).describe('Source colors to generate shades from (at least one required)'),
  colorSpace: z
    .enum(['LCH', 'OKLCH', 'LAB', 'OKLAB', 'HSL', 'HSLUV', 'HSV', 'CMYK', 'RGB', 'HEX', 'P3'])
    .describe('Color space used for shade interpolation (default: "LCH")'),
  algorithmVersion: z.enum(['v1', 'v2', 'v3']).describe('Algorithm version (use "v3" for best results)'),
})

export const zTheme = z.object({
  id: z
    .string()
    .optional()
    .describe(
      'Theme identifier — use "00000000000" exclusively for the default base theme (name must be "None"). For any named theme (Light, Dark, Brand, etc.), generate a random 11-character lowercase hex string (e.g. "9e3d5b0f12a").',
    ),
  name: z.string().min(1).describe('Theme name — use "None" exclusively for the default base theme (id "00000000000"). For named themes use descriptive names (e.g. "Light", "Dark").'),
  description: z.string().optional().describe('Theme description, use empty string if none'),
  scale: z
    .record(z.string(), z.number().min(0).max(100))
    .optional()
    .describe(
      'Lightness scale: maps each stop name (string) to a lightness percentage (number). ' +
        'If omitted, a linear scale is auto-generated from the preset stops/min/max. ' +
        'Example for CUSTOM_10_100: {"10": 90, "20": 74, "30": 58, "40": 42, "50": 26, "60": 10}.',
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
  type: z.enum(['default theme', 'custom theme']).optional().describe('Theme type — "default theme" is reserved exclusively for the base theme (id "00000000000", name "None"). All named themes (Light, Dark, Brand, etc.) must use "custom theme".'),
})

export const zSystemSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .describe('Unique identifier for the taxonomy group — generate a random 11-character lowercase hex string (e.g. "4a7f2c1e09b")'),
        name: z.string().min(1).describe('Display name of the group'),
        members: z
          .array(
            z.object({
              id: z
                .string()
                .min(1)
                .describe(
                  'Unique identifier for the member — generate a random 11-character lowercase hex string (e.g. "9e3d5b0f12a"). Referenced in bindings path arrays, so must stay consistent within the same request',
                ),
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

export const zBindings = z
  .array(
    z.object({
      path: z.array(z.string().min(1)).min(1).describe('Ordered member ids identifying the token (one per group, at least one)'),
      description: z.string().optional().describe('Optional description for the token'),
      ref: zRef.describe('Default primitive ref in the format "colorId:shadeName" (e.g. "blue:500")'),
      overrides: z
        .record(z.string(), zRef)
        .optional()
        .describe('Per-theme overrides mapping themeId to a different "colorId:shadeName" ref'),
      isExcluded: z.boolean().optional().describe('When true the token is present in the output but excluded from code generation'),
    }),
  )
  .optional()
  .describe('Bindings mapping taxonomy paths to primitive color refs')
