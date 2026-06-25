/**
 * Certification store refactored into signal-based reactive dependency graph.
 *
 * This replaces the old imperative store with a signal graph where:
 *  - certificationList$: Signal<CertificationRecord[]> — raw list
 *  - filter$: Signal<FilterCriteria>            — active filter
 *  - sort$: Signal<SortCriteria>                — active sort
 *  - selectedId$: Signal<string | null>         — selected certificate id
 *  - visibleCertifications$: Computed<CertificationRecord[]> — derived list
 *
 * Components use `useSignal(certificationStore.visibleCertifications$)`
 * to subscribe to the filtered/sorted view and automatically re-render
 * when any dependency changes.
 */

import { createSignal } from "@/src/services/reactive/signal";
import { createComputed } from "@/src/services/reactive/computed";
import type { Signal, Computed } from "@/src/types/reactive";
import type { CertificationRecord } from "@/src/types/certification";

// ── filter / sort types ─────────────────────────────────────────────────

export type FilterField = "status" | "region" | "productType";

export interface FilterCriteria {
  /** Field to filter on, or null for no filter. */
  field: FilterField | null;
  /** Value to match. */
  value: string | null;
}

export type SortDirection = "asc" | "desc";

export interface SortCriteria {
  /** Field to sort by, or null for insertion order. */
  field: "trustScore" | "updatedAt" | "id" | null;
  /** Sort direction. */
  direction: SortDirection;
}

// ── store shape ──────────────────────────────────────────────────────────

export interface CertificationSignalStore {
  /** The full, unfiltered list of certification records. */
  certificationList$: Signal<CertificationRecord[]>;
  /** Active filter criteria. */
  filter$: Signal<FilterCriteria>;
  /** Active sort criteria. */
  sort$: Signal<SortCriteria>;
  /** Currently selected certificate id (for detail panel). */
  selectedId$: Signal<string | null>;
  /** Derived: filtered + sorted list of visible certifications. */
  visibleCertifications$: Computed<CertificationRecord[]>;
  /** Derived: the selected certificate record (or null). */
  selectedCertification$: Computed<CertificationRecord | null>;
  /** Derived: count of visible certifications. */
  visibleCount$: Computed<number>;
}

// ── factory ──────────────────────────────────────────────────────────────

export function createCertificationSignalStore(): CertificationSignalStore {
  const certificationList$ = createSignal<CertificationRecord[]>([]);
  const filter$ = createSignal<FilterCriteria>({ field: null, value: null });
  const sort$ = createSignal<SortCriteria>({ field: null, direction: "asc" });
  const selectedId$ = createSignal<string | null>(null);

  // Derived: filter → sort
  const visibleCertifications$ = createComputed<CertificationRecord[]>(() => {
    let list = certificationList$.get();
    const filter = filter$.get();
    const sort = sort$.get();

    // Apply filter.
    if (filter.field !== null && filter.value !== null) {
      list = list.filter((record) => {
        if (filter.field === "status") return record.status === filter.value;
        // Extend with other filter fields as needed.
        return true;
      });
    }

    // Apply sort.
    if (sort.field !== null) {
      const multiplier = sort.direction === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const aVal = a[sort.field!];
        const bVal = b[sort.field!];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return (aVal - bVal) * multiplier;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return aVal.localeCompare(bVal) * multiplier;
        }
        return 0;
      });
    }

    return list;
  });

  // Derived: selected certification
  const selectedCertification$ = createComputed<CertificationRecord | null>(() => {
    const id = selectedId$.get();
    if (id === null) return null;
    const list = certificationList$.get();
    return list.find((r) => r.id === id) ?? null;
  });

  // Derived: count of visible certifications
  const visibleCount$ = createComputed<number>(() => {
    return visibleCertifications$.get().length;
  });

  return {
    certificationList$,
    filter$,
    sort$,
    selectedId$,
    visibleCertifications$,
    selectedCertification$,
    visibleCount$,
  };
}

/** Shared singleton for the certification page. */
export const defaultCertificationStore = createCertificationSignalStore();
