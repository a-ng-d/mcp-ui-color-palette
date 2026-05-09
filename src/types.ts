export interface Env {
  API_URL: string
  OAUTH_SERVER_URL: string
  SUPABASE_ANON_KEY: string
  MCP_OBJECT: DurableObjectNamespace
}

export interface Props extends Record<string, unknown> {
  accessToken?: string
}
