/**
 * Lazy locale loading + message resolution.
 *
 * English is imported statically so it ships in the initial bundle and is
 * always available synchronously (SSR-safe first render, fallback target).
 * Every other locale is pulled with a dynamic `import()` — the bundler
 * (Turbopack/webpack) emits one code-split chunk per translation file, so
 * only the requested locale travels over the wire on demand.
 *
 * Fallback chain for any message id: requested locale -> English -> raw id.
 */

import en from "./translations/en.json";

export type Messages = Record<string, string>;

export const DEFAULT_LOCALE = "en";

export const SUPPORTED_LOCALES = ["en", "fr", "es", "ar", "zh"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Locales whose script reads right-to-left (for `dir`/layout decisions). */
export const RTL_LOCALES: ReadonlySet<string> = new Set(["ar"]);

export function isSupportedLocale(lang: string): lang is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang);
}

export function isRtl(lang: string): boolean {
  return RTL_LOCALES.has(lang);
}

const cache = new Map<string, Messages>();
const inflight = new Map<string, Promise<Messages>>();

// Seed the cache with the statically-bundled English source.
cache.set(DEFAULT_LOCALE, en as Messages);

async function importLocale(lang: SupportedLocale): Promise<Messages> {
  // The template literal keeps the dynamic import tied to ./translations/*,
  // so the bundler can statically discover and split each locale chunk.
  const mod = await import(`./translations/${lang}.json`);
  return (mod.default ?? mod) as Messages;
}

/**
 * Load (and cache) the message catalogue for `lang`.
 * Concurrent calls for the same locale share one in-flight promise.
 * Unknown or failed locales resolve to the English catalogue.
 */
export async function loadLocale(lang: string): Promise<Messages> {
  const cached = cache.get(lang);
  if (cached) return cached;

  if (!isSupportedLocale(lang)) {
    return loadLocale(DEFAULT_LOCALE);
  }

  const pending = inflight.get(lang);
  if (pending) return pending;

  const promise = importLocale(lang)
    .then((messages) => {
      cache.set(lang, messages);
      inflight.delete(lang);
      return messages;
    })
    .catch((err) => {
      inflight.delete(lang);
      if (lang !== DEFAULT_LOCALE) return loadLocale(DEFAULT_LOCALE);
      throw err;
    });

  inflight.set(lang, promise);
  return promise;
}

export function isLocaleLoaded(lang: string): boolean {
  return cache.has(lang);
}

export function getCachedMessages(lang: string): Messages | undefined {
  return cache.get(lang);
}

/**
 * Resolve a single message id through the fallback chain:
 * requested locale -> English -> the raw id itself.
 * Returns the ICU source string (formatting happens in `formatICU`).
 */
export function resolveMessage(lang: string, id: string): string {
  const primary = cache.get(lang);
  if (primary && id in primary) return primary[id];

  const fallback = cache.get(DEFAULT_LOCALE);
  if (fallback && id in fallback) return fallback[id];

  return id;
}

/** Test helper: reset to a clean cache (English re-seeded). */
export function resetLocaleCache(): void {
  cache.clear();
  inflight.clear();
  cache.set(DEFAULT_LOCALE, en as Messages);
}
