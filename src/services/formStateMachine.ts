"use client";

import { useEffect, useReducer } from "react";
import { loadFormDraft, saveFormDraft, type FormDraft } from "@/src/services/cache";
import type {
  FieldError,
  FormStep,
  ProductRegistration,
} from "@/src/types/registration";

export const FORM_AUTO_SAVE_DEBOUNCE_MS = 2000;
export const MAX_DEPENDENCY_FIELDS = 50;

export type FormMachineStatus =
  | "IDLE"
  | "FILLING"
  | "VALIDATING"
  | "SUBMITTING"
  | "SUCCESS"
  | "ERROR"
  | "DRAFT_RECOVERED";

export type ValidationTarget = FormStep | "all";

export interface FieldDependency<TData extends object> {
  field: string;
  dependsOn: string[];
  compute: (data: TData) => unknown;
}

export interface FieldDependencyGraph<TData extends object> {
  fields: string[];
  dependenciesByField: Map<string, FieldDependency<TData>>;
  dependentsByField: Map<string, string[]>;
}

export interface FormMachineState<TData extends object = ProductRegistration> {
  status: FormMachineStatus;
  productId: string;
  data: TData;
  initialData: TData;
  currentStep: FormStep;
  errors: FieldError[];
  dirty: boolean;
  draft?: FormDraft<TData>;
  error?: string;
  validatingStep?: ValidationTarget;
  lastSavedAt?: number;
  dependencyGraph?: FieldDependencyGraph<TData>;
}

export type FormMachineAction<TData extends object = ProductRegistration> =
  | { type: "START_FILLING" }
  | {
      type: "FIELD_CHANGED";
      field: keyof TData & string;
      value: TData[keyof TData];
    }
  | { type: "SET_STEP"; step: FormStep }
  | { type: "VALIDATE_STEP"; step: ValidationTarget }
  | { type: "VALIDATION_PASSED"; nextStep?: FormStep }
  | { type: "VALIDATION_FAILED"; errors: FieldError[] }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_SUCCEEDED" }
  | { type: "SUBMIT_FAILED"; error: string }
  | { type: "DRAFT_FOUND"; draft: FormDraft<TData> }
  | { type: "DRAFT_ACCEPTED" }
  | { type: "DRAFT_DISMISSED" }
  | { type: "DRAFT_SAVED"; savedAt: number }
  | { type: "DRAFT_SAVE_FAILED"; error: string }
  | { type: "RESET"; data?: TData };

export interface UseFormStateMachineOptions<TData extends object> {
  productId: string;
  initialData: TData;
  initialStep?: FormStep;
  dependencyGraph?: FieldDependencyGraph<TData>;
  autoSave?: boolean;
}

export function createDependencyGraph<TData extends object>(
  dependencies: FieldDependency<TData>[]
): FieldDependencyGraph<TData> {
  if (dependencies.length > MAX_DEPENDENCY_FIELDS) {
    throw new Error(
      `Field dependency graph supports a maximum of ${MAX_DEPENDENCY_FIELDS} fields`
    );
  }

  const dependenciesByField = new Map<string, FieldDependency<TData>>();
  const dependentsByField = new Map<string, string[]>();

  for (const dependency of dependencies) {
    if (dependenciesByField.has(dependency.field)) {
      throw new Error(`Duplicate dependency declaration for ${dependency.field}`);
    }

    dependenciesByField.set(dependency.field, dependency);

    for (const parent of dependency.dependsOn) {
      const dependents = dependentsByField.get(parent) ?? [];
      dependents.push(dependency.field);
      dependentsByField.set(parent, dependents);
    }
  }

  assertAcyclicDependencyGraph(dependenciesByField);

  return {
    fields: dependencies.map((dependency) => dependency.field),
    dependenciesByField,
    dependentsByField,
  };
}

export function recomputeDependents<TData extends object>(
  data: TData,
  changedField: string,
  graph: FieldDependencyGraph<TData>
): { data: TData; recomputedFields: string[] } {
  const recomputedFields = getTransitiveDependents(changedField, graph);
  const nextData = { ...data } as Record<string, unknown>;

  for (const field of recomputedFields) {
    const dependency = graph.dependenciesByField.get(field);
    if (!dependency) continue;
    nextData[field] = dependency.compute(nextData as TData);
  }

  return { data: nextData as TData, recomputedFields };
}

export function createInitialFormState<TData extends object>(
  productId: string,
  data: TData,
  options: {
    initialStep?: FormStep;
    dependencyGraph?: FieldDependencyGraph<TData>;
  } = {}
): FormMachineState<TData> {
  return {
    status: "IDLE",
    productId,
    data,
    initialData: data,
    currentStep: options.initialStep ?? "basic-info",
    errors: [],
    dirty: false,
    dependencyGraph: options.dependencyGraph,
  };
}

export function formStateReducer<TData extends object>(
  state: FormMachineState<TData>,
  action: FormMachineAction<TData>
): FormMachineState<TData> {
  switch (action.type) {
    case "START_FILLING":
      return {
        ...state,
        status: "FILLING",
        error: undefined,
        validatingStep: undefined,
      };

    case "FIELD_CHANGED": {
      const updatedData = {
        ...(state.data as Record<string, unknown>),
        [action.field]: action.value,
      } as TData;
      const recomputed = state.dependencyGraph
        ? recomputeDependents(updatedData, action.field, state.dependencyGraph)
        : { data: updatedData };

      const changedFields = new Set([
        action.field,
        ...("recomputedFields" in recomputed ? recomputed.recomputedFields : []),
      ]);

      return {
        ...state,
        status: "FILLING",
        data: recomputed.data,
        dirty: true,
        error: undefined,
        errors: state.errors.filter((error) => !changedFields.has(error.field)),
      };
    }

    case "SET_STEP":
      return {
        ...state,
        currentStep: action.step,
        error: undefined,
      };

    case "VALIDATE_STEP":
      return {
        ...state,
        status: "VALIDATING",
        validatingStep: action.step,
        error: undefined,
      };

    case "VALIDATION_PASSED":
      return {
        ...state,
        status: "FILLING",
        currentStep: action.nextStep ?? state.currentStep,
        errors: [],
        error: undefined,
        validatingStep: undefined,
      };

    case "VALIDATION_FAILED":
      return {
        ...state,
        status: "ERROR",
        errors: action.errors,
        error: action.errors[0]?.message ?? "Validation failed",
        validatingStep: undefined,
      };

    case "SUBMIT":
      return {
        ...state,
        status: "SUBMITTING",
        error: undefined,
      };

    case "SUBMIT_SUCCEEDED":
      return {
        ...state,
        status: "SUCCESS",
        dirty: false,
        errors: [],
        error: undefined,
      };

    case "SUBMIT_FAILED":
      return {
        ...state,
        status: "ERROR",
        error: action.error,
      };

    case "DRAFT_FOUND":
      return {
        ...state,
        status: "DRAFT_RECOVERED",
        draft: action.draft,
        error: undefined,
      };

    case "DRAFT_ACCEPTED":
      if (!state.draft) return state;
      return {
        ...state,
        status: "FILLING",
        data: state.draft.data,
        currentStep: state.draft.currentStep,
        dirty: false,
        lastSavedAt: state.draft.updatedAt,
        error: undefined,
      };

    case "DRAFT_DISMISSED":
      return {
        ...state,
        status: "IDLE",
        draft: undefined,
        data: state.initialData,
        currentStep: "basic-info",
        dirty: false,
        error: undefined,
      };

    case "DRAFT_SAVED":
      return {
        ...state,
        dirty: false,
        lastSavedAt: action.savedAt,
      };

    case "DRAFT_SAVE_FAILED":
      return {
        ...state,
        status: "ERROR",
        error: action.error,
      };

    case "RESET": {
      const data = action.data ?? state.initialData;
      return {
        ...createInitialFormState(state.productId, data, {
          dependencyGraph: state.dependencyGraph,
        }),
        initialData: data,
      };
    }

    default:
      return state;
  }
}

export function getRegistrationDependencyGraph(): FieldDependencyGraph<ProductRegistration> {
  return createDependencyGraph<ProductRegistration>([
    {
      field: "totalValue",
      dependsOn: ["quantity", "pricePerUnit"],
      compute: (data) => {
        const quantity = Number.isFinite(data.quantity) ? data.quantity : 0;
        const pricePerUnit = Number.isFinite(data.pricePerUnit)
          ? data.pricePerUnit
          : 0;
        return quantity * pricePerUnit;
      },
    },
  ]);
}

export function useFormStateMachine<TData extends object>({
  productId,
  initialData,
  initialStep,
  dependencyGraph,
  autoSave = true,
}: UseFormStateMachineOptions<TData>): [
  FormMachineState<TData>,
  React.Dispatch<FormMachineAction<TData>>
] {
  const [state, dispatch] = useReducer(
    formStateReducer<TData>,
    undefined,
    () =>
      createInitialFormState(productId, initialData, {
        initialStep,
        dependencyGraph,
      })
  );

  useEffect(() => {
    let cancelled = false;

    loadFormDraft<TData>(productId)
      .then((draft) => {
        if (!cancelled && draft) {
          dispatch({ type: "DRAFT_FOUND", draft });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          dispatch({
            type: "DRAFT_SAVE_FAILED",
            error:
              error instanceof Error
                ? error.message
                : "Failed to load saved draft",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!autoSave || state.status !== "FILLING" || !state.dirty) return;

    const timeout = window.setTimeout(() => {
      saveFormDraft({
        productId: state.productId,
        data: state.data,
        currentStep: state.currentStep,
      })
        .then((draft) => {
          dispatch({ type: "DRAFT_SAVED", savedAt: draft.updatedAt });
        })
        .catch((error: unknown) => {
          dispatch({
            type: "DRAFT_SAVE_FAILED",
            error:
              error instanceof Error
                ? error.message
                : "Failed to save form draft",
          });
        });
    }, FORM_AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    autoSave,
    state.currentStep,
    state.data,
    state.dirty,
    state.productId,
    state.status,
  ]);

  return [state, dispatch];
}

function getTransitiveDependents<TData extends object>(
  changedField: string,
  graph: FieldDependencyGraph<TData>
): string[] {
  const affected = new Set<string>();

  function collect(field: string): void {
    for (const dependent of graph.dependentsByField.get(field) ?? []) {
      if (affected.has(dependent)) continue;
      affected.add(dependent);
      collect(dependent);
    }
  }

  collect(changedField);

  const ordered: string[] = [];
  const visited = new Set<string>();

  function visit(field: string): void {
    if (visited.has(field)) return;
    visited.add(field);

    const dependency = graph.dependenciesByField.get(field);
    for (const parent of dependency?.dependsOn ?? []) {
      if (affected.has(parent)) {
        visit(parent);
      }
    }

    ordered.push(field);
  }

  for (const field of affected) {
    visit(field);
  }

  return ordered;
}

function assertAcyclicDependencyGraph<TData extends object>(
  dependenciesByField: Map<string, FieldDependency<TData>>
): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(field: string): void {
    if (visited.has(field)) return;
    if (visiting.has(field)) {
      throw new Error(`Cycle detected in field dependency graph at ${field}`);
    }

    visiting.add(field);

    const dependency = dependenciesByField.get(field);
    for (const parent of dependency?.dependsOn ?? []) {
      if (dependenciesByField.has(parent)) {
        visit(parent);
      }
    }

    visiting.delete(field);
    visited.add(field);
  }

  for (const field of dependenciesByField.keys()) {
    visit(field);
  }
}
