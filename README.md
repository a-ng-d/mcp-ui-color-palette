# UI Color Palette MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server built on Cloudflare Workers using the [Agents SDK](https://developers.cloudflare.com/agents/) (`McpAgent` + Durable Objects) that exposes the UI Color Palette API as tools for AI agents and LLMs.

## Transport

Streamable HTTP at `/mcp` (supports both SSE and Streamable HTTP transports).

## Available Tools

### Palette Generation

| Tool                          | Description                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `get_full_palette`            | Generate a complete color palette from base and theme configurations                                    |
| `create_color_harmony`        | Create color harmonies (complementary, analogous, triadic, tetradic, compound, square)       |
| `extract_dominant_colors`     | Extract dominant colors from a JPEG/PNG image URL                                                       |
| `generate_code`               | Generate design tokens/code from base + themes (CSS, SCSS, Less, Tailwind v3/v4, SwiftUI, UIKit, Compose, CSV, DTCG, etc.) |
| `generate_colors_from_prompt` | Generate a palette from a natural language description via AI                                           |

#### generate_code input

The `generate_code` tool expects:

- `base`: base palette configuration
- `themes`: array of theme configurations
- `format` (optional)
- `colorSpace` (optional)

This mirrors the API `POST /v1/generate-code` contract and no longer uses a `paletteData` input.

The MCP server calls versioned API routes and automatically prefixes requests with `/v1`.

### Authentication

Authenticated tools (`Auth: Yes`) use **OAuth 2.1**. MCP clients that support OAuth auto-configure via the discovery endpoint at `/.well-known/oauth-authorization-server`. The Bearer token is passed in the `Authorization` header and injected into every tool call automatically — no manual token parameter is needed.

### Published Palettes

| Tool                         | Auth | Description                                           |
| ---------------------------- | ---- | ----------------------------------------------------- |
| `list_published_palettes`    | No   | List publicly shared palettes (paginated, searchable) |
| `list_my_published_palettes` | Yes  | List the authenticated user's own palettes            |
| `publish_palette`            | Yes  | Publish a new palette                                 |
| `get_published_palette`      | No   | Get a specific shared palette by ID                   |
| `share_published_palette`    | Yes  | Make a palette publicly visible                       |
| `unshare_published_palette`  | Yes  | Make a palette private                                |
| `update_published_palette`   | Yes  | Update an existing palette                            |
| `unpublish_palette`          | Yes  | Permanently delete a palette                          |

## Configuration

### VS Code / Copilot

Add to your `settings.json` or `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "ui-color-palette": {
        "type": "http",
        "url": "https://mcp-uicp.<your-subdomain>.workers.dev/mcp"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ui-color-palette": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp-uicp.<your-subdomain>.workers.dev/mcp"
      ]
    }
  }
}
```

## Development

```bash
npm install
npm run dev        # Start local dev server
npm run deploy     # Deploy to Cloudflare
```

### Environment Variables

| Variable  | Description                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------- |
| `API_URL` | Base URL of the deployed [api-ui-color-palette](https://github.com/a-ng-d/api-ui-color-palette) worker (without `/v1`) |

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
