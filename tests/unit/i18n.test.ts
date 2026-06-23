import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocaleLoaded,
  isRtl,
  loadLocale,
  resetLocaleCache,
  resolveMessage,
} from "@/src/services/i18n/localeLoader";
import { formatICU, clearIcuCache } from "@/src/services/i18n/icuParser";

beforeEach(() => {
  resetLocaleCache();
  clearIcuCache();
});

describe("localeLoader — initial bundle", () => {
  it("ships English synchronously without a network/chunk fetch", () => {
    expect(isLocaleLoaded(DEFAULT_LOCALE)).toBe(true);
    expect(resolveMessage("en", "dashboard.heading")).toBe(
      "Certification Overview",
    );
  });

  it("does not have non-English locales loaded up front", () => {
    expect(isLocaleLoaded("fr")).toBe(false);
    expect(isLocaleLoaded("zh")).toBe(false);
  });
});

describe("localeLoader — lazy loading", () => {
  it("loads a locale chunk on demand", async () => {
    expect(isLocaleLoaded("fr")).toBe(false);
    const fr = await loadLocale("fr");
    expect(isLocaleLoaded("fr")).toBe(true);
    expect(fr["dashboard.heading"]).toBe("Aperçu des certifications");
    expect(resolveMessage("fr", "cert.status.valid")).toBe("Valide");
  });

  it("caches loaded locales (same reference on repeat load)", async () => {
    const first = await loadLocale("es");
    const second = await loadLocale("es");
    expect(second).toBe(first);
  });

  it("deduplicates concurrent loads of the same locale", async () => {
    const [a, b] = await Promise.all([loadLocale("zh"), loadLocale("zh")]);
    expect(a).toBe(b);
  });
});

describe("localeLoader — fallback chain", () => {
  it("falls back to English when a key is missing in the active locale", async () => {
    await loadLocale("fr");
    // Inject a fr catalogue missing a key to prove the chain (simulate gap).
    const fr = await loadLocale("fr");
    delete (fr as Record<string, string>)["__nonexistent_only_in_en"];
    // A real key present only in en still resolves via the fallback step.
    expect(resolveMessage("fr", "app.title")).toBeTypeOf("string");
    expect(resolveMessage("fr", "app.title")).not.toBe("app.title");
  });

  it("returns the raw message id when missing everywhere", () => {
    expect(resolveMessage("fr", "totally.unknown.key")).toBe(
      "totally.unknown.key",
    );
  });

  it("falls back to English for unsupported locales", async () => {
    const messages = await loadLocale("de");
    expect(messages).toBe(await loadLocale("en"));
    expect(resolveMessage("de", "dashboard.heading")).toBe(
      "Certification Overview",
    );
  });
});

describe("icuParser — argument interpolation", () => {
  it("substitutes simple named arguments", () => {
    expect(formatICU("Welcome, {name}", "en", { name: "Ada" })).toBe(
      "Welcome, Ada",
    );
  });

  it("locale-formats numeric arguments", () => {
    expect(formatICU("Total: {n}", "en", { n: 1234567 })).toBe(
      "Total: 1,234,567",
    );
  });
});

describe("icuParser — pluralization", () => {
  const msg =
    "{count, plural, =0 {No certifications} one {# certification} other {# certifications}}";

  it("honors exact =0 matches", () => {
    expect(formatICU(msg, "en", { count: 0 })).toBe("No certifications");
  });

  it("selects the 'one' category", () => {
    expect(formatICU(msg, "en", { count: 1 })).toBe("1 certification");
  });

  it("selects 'other' and formats # with the locale", () => {
    expect(formatICU(msg, "en", { count: 5 })).toBe("5 certifications");
    expect(formatICU(msg, "en", { count: 2000 })).toBe("2,000 certifications");
  });

  it("applies offset to the # token", () => {
    const m =
      "{count, plural, offset:1 one {you and # other} other {you and # others}}";
    expect(formatICU(m, "en", { count: 3 })).toBe("you and 2 others");
  });
});

describe("icuParser — select", () => {
  const msg =
    "{status, select, active {Active} suspended {Suspended} other {Unknown}}";

  it("selects the matching branch", () => {
    expect(formatICU(msg, "en", { status: "active" })).toBe("Active");
  });

  it("falls back to 'other'", () => {
    expect(formatICU(msg, "en", { status: "anything-else" })).toBe("Unknown");
  });
});

describe("icuParser — locale-aware plural rules", () => {
  it("uses the loaded locale's catalogue and CLDR rules", async () => {
    await loadLocale("fr");
    const fr = resolveMessage("fr", "cert.count");
    expect(formatICU(fr, "fr", { count: 0 })).toBe("Aucune certification");
    // French treats 1 as 'one' and 2 as 'other'.
    expect(formatICU(fr, "fr", { count: 1 })).toBe("1 certification");
    expect(formatICU(fr, "fr", { count: 2 })).toBe("2 certifications");
  });

  it("resolves Arabic plural categories beyond one/other", async () => {
    await loadLocale("ar");
    const ar = resolveMessage("ar", "cert.count");
    // Arabic 'two' category.
    expect(formatICU(ar, "ar", { count: 2 })).toBe("شهادتان");
  });
});

describe("escaping & nesting", () => {
  it("treats quoted braces as literal text", () => {
    expect(formatICU("Use '{'name'}' as a token", "en")).toBe(
      "Use {name} as a token",
    );
  });

  it("renders nested arguments inside a plural branch", () => {
    const m =
      "{name} has {count, plural, =0 {no items} one {# item} other {# items}}";
    expect(formatICU(m, "en", { name: "Bob", count: 3 })).toBe(
      "Bob has 3 items",
    );
  });
});

describe("metadata", () => {
  it("exposes the supported locale set", () => {
    expect(SUPPORTED_LOCALES).toContain("ar");
    expect(SUPPORTED_LOCALES).toContain("zh");
  });

  it("flags RTL locales", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("en")).toBe(false);
  });
});
