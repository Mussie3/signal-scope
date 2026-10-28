/// <reference lib="dom" />
// SignalScope :: the script-tag entry point
//
// The collector itself is a module, which suits anything with a build step and
// suits nothing without one. Most of the platforms worth supporting - Rails,
// Django, WordPress, a hand-written page - have no bundler at all, and asking
// them to adopt one to get a service map is asking them not to bother.
//
// So this wraps the collector in two things: a global for people who want to
// call it, and an auto-start that reads the script tag's own data attributes
// for people who would rather write no JavaScript whatsoever.
//
//   <script src="https://<host>/collector.js"
//           data-service="checkout-web"
//           data-endpoint="https://<ref>.supabase.co/functions/v1/otlp"
//           data-key="pk_..."
//           data-first-party="https://api.example.com"></script>
//
// That tag is the whole integration for a platform that cannot import anything.

import { install, type CollectorConfig } from './signalscope'

declare global {
  interface Window {
    SignalScope?: { install: typeof install }
  }
}

window.SignalScope = { install }

const originOf = (url: string): string[] => {
  try {
    return [new URL(url, location.href).origin]
  } catch {
    return []
  }
}

/** The <script> that loaded this file, so its attributes can configure it. */
const self = document.currentScript as HTMLScriptElement | null

if (self?.dataset.service && self.dataset.endpoint && self.dataset.key) {
  const config: CollectorConfig = {
    serviceName: self.dataset.service,
    endpoint: self.dataset.endpoint,
    apiKey: self.dataset.key,
    // Comma-separated, because a data attribute cannot hold an array and the
    // alternative is asking people to write JSON inside an HTML attribute.
    firstPartyOrigins: self.dataset.firstParty
      ? self.dataset.firstParty.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    ...(self.dataset.region ? { region: self.dataset.region } : {}),
    ...(self.dataset.sampleRate ? { sampleRate: Number(self.dataset.sampleRate) } : {}),
    // Fetching this very script is not a dependency. The tag knows where it
    // came from, so the page never has to be told.
    ignoreOrigins: originOf(self.src),
  }

  try {
    install(config)
  } catch {
    // Telemetry must never be the reason a page fails to work. A collector
    // that throws during init on some browser it was not tested against is
    // strictly worse than no collector.
  }
}
