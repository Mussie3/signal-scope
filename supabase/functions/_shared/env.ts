export const requireEnv = (name: string): string => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const env = {
  supabaseUrl: () => requireEnv('SUPABASE_URL'),
  serviceRoleKey: () => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
}
