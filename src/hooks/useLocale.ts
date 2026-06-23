"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isRtl,
  loadLocale,
  resolveMessage,
} from "@/src/services/i18n/localeLoader";
import { formatICU, type ICUVariables } from "@/src/services/i18n/icuParser";

export interface LocaleContextValue {
  /** Currently active locale code. */
  locale: string;
  /** All locales the app can switch to. */
  availableLocales: readonly string[];
  /** True while a locale switch is fetching/parsing a new catalogue. */
  isSwitching: boolean;
  /** True when the active locale uses a right-to-left script. */
  rtl: boolean;
  /** Translate a message id, applying ICU formatting with `vars`. */
  t: (id: string, vars?: ICUVariables) => string;
  /** Load + activate `lang`, re-rendering consumers. */
  switchLocale: (lang: string) => Promise<void>;
}

function translate(locale: string, id: string, vars?: ICUVariables): string {
  const message = resolveMessage(locale, id);
  // resolveMessage returns the raw id when nothing matched the fallback
  // chain — don't run that through ICU, just surface the id.
  if (message === id) return id;
  return formatICU(message, locale, vars);
}

// Default value: a working English implementation so consumers used outside a
// provider (or during SSR before hydration) still render real strings.
const defaultValue: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  availableLocales: SUPPORTED_LOCALES,
  isSwitching: false,
  rtl: isRtl(DEFAULT_LOCALE),
  t: (id, vars) => translate(DEFAULT_LOCALE, id, vars),
  switchLocale: async () => {},
};

const LocaleContext = createContext<LocaleContextValue>(defaultValue);

export interface LocaleProviderProps {
  children: ReactNode;
  /** Initial locale (English is always available synchronously). */
  initialLocale?: string;
}

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: LocaleProviderProps) {
  const [locale, setLocale] = useState(initialLocale);
  const [isSwitching, setIsSwitching] = useState(false);

  const switchLocale = useCallback(
    async (lang: string) => {
      if (lang === locale) return;
      setIsSwitching(true);
      try {
        // Populate the cache (with internal fallback to English) *before*
        // flipping the active locale, so the re-render reads ready data.
        await loadLocale(lang);
        setLocale(lang);
      } finally {
        setIsSwitching(false);
      }
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      availableLocales: SUPPORTED_LOCALES,
      isSwitching,
      rtl: isRtl(locale),
      t: (id, vars) => translate(locale, id, vars),
      switchLocale,
    }),
    [locale, isSwitching, switchLocale],
  );

  return createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
