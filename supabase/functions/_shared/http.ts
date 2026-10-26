// CORS + response helpers shared by every function.

export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const preflight = (req: Request): Response | null =>
  req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

export const fail = (message: string, status = 400): Response => json({ error: message }, status)

// ---------------------------------------------------------------------------
// Origin-reflecting CORS, for endpoints called directly from a page.
//
// A browser will not hand a cross-origin response to JavaScript unless
// Access-Control-Allow-Origin matches the requesting origin exactly; '*' is
// rejected once credentials are involved and is sloppy regardless. So the
// request's own Origin is echoed back.
//
// The preflight is deliberately permissive: a browser sends OPTIONS before it
// sends the Authorization header, so the key cannot be validated at that point.
// That is safe, because a preflight grants no data - the POST that follows still
// has to authenticate and pass the origin allowlist. Refusing unknown origins at
// preflight would only turn an honest 403 into a confusing CORS error.
// ---------------------------------------------------------------------------
export const reflectCors = (req: Request): Record<string, string> => {
  const origin = req.headers.get('origin')
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // Caches must not serve one site's CORS response to another.
    Vary: 'Origin',
  }
}

export const preflightReflecting = (req: Request): Response | null =>
  req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: reflectCors(req) }) : null

export const jsonReflecting = (req: Request, body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...reflectCors(req), 'Content-Type': 'application/json' },
  })
