// SignalScope :: where an ingest key may travel, and what an origin is
//
// Pulled out of the request handler so it can be tested without a server. Both
// of these are small, fiddly, and the kind of thing that is wrong for months
// without anyone noticing.

/**
 * A key arrives one of two ways, and the second is not a shortcut.
 *
 *   Authorization: Bearer <key>   - the normal path
 *   ?key=<key>                    - the sendBeacon path
 *
 * navigator.sendBeacon cannot set headers at all, and it is the only send that
 * survives page unload - which is exactly when the last and most interesting
 * batch is buffered. So a query parameter is the only option there. It is
 * acceptable only because publishable keys are public by design: a pk_ in a URL
 * is not an exposure, where an sk_ would be.
 */
export const extractKey = (req: Request): string | null => {
  const header = req.headers.get('authorization')
  if (header) {
    // The Headers API normalises values, so `Bearer   ` arrives as `Bearer`.
    // A regex requiring whitespace after the scheme therefore does not match,
    // and without the second guard the scheme itself falls through as the
    // credential - producing "invalid key" where the truth is "no key given".
    const raw = header.trim()
    const token = /^Bearer\s+/i.test(raw) ? raw.replace(/^Bearer\s+/i, '').trim() : raw
    if (token && !/^Bearer$/i.test(token)) return token
  }
  const fromQuery = new URL(req.url).searchParams.get('key')
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null
}

/** A secret key must never be accepted from a URL: query strings end up in
 *  access logs, proxies and Referer headers, and an sk_ there is a real leak. */
export const keyIsPublishable = (key: string): boolean => key.startsWith('pk_')

export const keyCameFromUrl = (req: Request): boolean =>
  !req.headers.get('authorization') && !!new URL(req.url).searchParams.get('key')

/**
 * The Origin a request claims. Browsers set this and scripts cannot override it,
 * which is what makes an allowlist worth having at all - but curl can send
 * anything, so this authorises a SITE, never a caller. Treated accordingly.
 */
export const requestOrigin = (req: Request): string | null => {
  const origin = req.headers.get('origin')
  if (origin && origin !== 'null') return origin
  // sendBeacon from some embedded contexts omits Origin but sends Referer;
  // reducing it to an origin is better than rejecting a legitimate page.
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      return null
    }
  }
  return null
}

/** OTLP exporters POST to <endpoint>/v1/traces; curl users tend to hit the root. */
export const isTracesPath = (pathname: string): boolean =>
  pathname.endsWith('/v1/traces') || pathname.endsWith('/otlp') || pathname.endsWith('/otlp/')
