# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.6] - 2026-05-23

### Fixed

- `zColor` schema: `chroma` object field renamed from `chroma` to `shift` — now matches the API validation (`chroma.shift`) and is consistent with the `hue` object (`hue.shift`)

## [1.1.5] - 2026-05-23

### Fixed

- `ThemeConfiguration` schema: `"default theme"` is now documented as reserved exclusively for the base theme (`id: "00000000000"`, `name: "None"`); all named themes must use `"custom theme"`
- `id` and `name` field descriptions clarified to make the default/custom theme distinction unambiguous for LLM consumers

## [1.1.4] - 2026-05-23

### Fixed

- Theme `id` description updated to explicitly reserve `"00000000000"` for the default base theme and require a random 11-character hex string for all named themes
- Theme `name` description updated to explicitly reserve `"None"` for the default base theme

## [1.1.3] - 2026-05-14

### Changed

- `zPresetId` is now a proper Zod enum — the 19 supported preset identifiers are validated at the input level
- `zColor` and `zTheme` descriptions clarified: normalized RGB values (0.0–1.0), random hex string identifiers, and default values for optional fields are all explicitly documented in the schema

## [1.1.2] - 2026-05-10

### Added

- `preview_palette` tool — builds a compact preview image URL from `get_palette` output and returns it as a markdown image link that renders inline in Claude, Cursor, and other MCP clients

## [1.1.1] - 2026-05-10

### Changed

- Refactored `helpers.ts`, `community.ts`, and `palette.ts` to use arrow function syntax consistently
- Updated Wrangler to 4.86.0

## [1.1.0] - 2026-05-10

### Added

- `publish_palette` tool — save a palette to the database (requires authentication)
- `update_published_palette` tool — update an existing published palette (requires authentication)
- `share_published_palette` tool — make a palette publicly visible in the community (requires authentication)
- `unshare_published_palette` tool — make a palette private (requires authentication)
- `unpublish_palette` tool — permanently delete a published palette (requires authentication)
- `list_published_palettes` tool — browse the community
- `list_my_published_palettes` tool — list the authenticated user's own palettes (requires authentication)
- `compact` flag on `get_palette` (default: `true`) — returns a flat array of shade rows with only `theme`, `color`, `shade`, `hex`, `contrast`, and `textContrast`, omitting all raw color space values

## [1.0.16] - 2026-05-09

### Changed

- Color and theme identifiers now explicitly require a random 11-character lowercase hex string; format documented in schema descriptions
- Required fields validated more strictly: `rgb` normalized values (0.0–1.0), `hue.shift`, `chroma.chroma`, and `alpha.backgroundColor` all include clear constraints and defaults

### Fixed

- Type casting in `onConnect` method corrected for improved type safety

## [1.0.15] - 2026-05-09

### Added

- `zRgb` and `zPreset` Zod schemas as the foundation for stronger input validation

## [1.0.14] - 2026-05-09

### Added

- `/oauth/register` endpoint supporting dynamic client registration

### Fixed

- Improved error normalization in the OAuth token proxy (`/oauth/token`) — Supabase error fields are now mapped to standard `error` / `error_description`

## [1.0.13] - 2026-05-09

### Fixed

- OAuth metadata (`/.well-known/oauth-authorization-server`) now includes the `issuer` field set to the worker's own origin (RFC 8414 compliance)

## [1.0.12] - 2026-05-08

### Added

- `get_palette` now accepts an optional `system` configuration with `schema` (taxonomy groups) and `bindings` (path → primitive ref mappings) for semantic token generation

## [1.0.11] - 2026-05-08

### Added

- `get_color_system` tool — builds a `SystemData` object by resolving taxonomy bindings against a generated palette

### Changed

- Renamed `get_full_palette` → `get_palette`

## [1.0.10] - 2026-05-07

### Fixed

- Tools that require authentication now return `"Authentication required. Please sign in via OAuth to use this tool."` when no token is present

## [1.0.9] - 2026-04-28

### Changed

- All API calls now use versioned paths (`/v1/...`) — the `apiCall` helper prepends `/v1` automatically

## [1.0.8] - 2026-04-23

### Fixed

- Improved error normalization in the OAuth token proxy — Supabase error fields are mapped to standard `error` / `error_description` regardless of upstream shape

## [1.0.7] - 2026-04-23

### Added

- `create_color_harmony` tool — generates complementary, analogous, triadic, tetradic, compound, and square harmonies from a base RGB color with configurable spread angle and output format

## [1.0.6] - 2026-04-23

### Added

- `generate_code` tool — exports palette tokens from a `base` + `themes` configuration in 14 output formats: `css`, `scss`, `less`, `tailwind-v3`, `tailwind-v4`, `swift-ui`, `ui-kit`, `compose`, `resources`, `csv`, `native-tokens`, `dtcg-tokens`, `style-dictionary-v3`, `universal-json`

## [1.0.5] - 2026-04-23

### Changed

- Renamed `SUPABASE_URL` environment variable to `OAUTH_SERVER_URL` for consistency

## [1.0.4] - 2026-04-21

No substantive changes — version bump only.

## [1.0.3] - 2026-04-21

### Added

- `UICPMcp` agent now persists the access token in durable storage and restores it on reconnect

## [1.0.2] - 2026-04-19

### Added

- `readOnlyHint` annotations on read-only tools
- Cloudflare Workers observability and invocation logs enabled

### Fixed

- API URL updated to point to the correct deployed worker

## [1.0.1] - 2026-04-18

### Added

- Initial release: TypeScript, Wrangler, Prettier, Cloudflare Workers with Durable Objects
- `get_palette` tool — generates a complete color palette from `base` and `themes` configurations
- `generate_colors_from_prompt` tool — generates source colors from a natural language prompt using Mistral AI
- `extract_dominant_colors` tool — extracts dominant colors from an image URL using k-means clustering
- OAuth 2.0 proxy: `/.well-known/oauth-authorization-server` discovery and `/oauth/token` token exchange

[1.1.6]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.16...v1.1.0
[1.0.16]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.15...v1.0.16
[1.0.15]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.14...v1.0.15
[1.0.14]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.13...v1.0.14
[1.0.13]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.12...v1.0.13
[1.0.12]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/a-ng-d/mcp-ui-color-palette/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/a-ng-d/mcp-ui-color-palette/releases/tag/v1.0.1
