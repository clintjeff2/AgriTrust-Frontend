"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { deleteFormDraft } from "@/src/services/cache";
import {
  getRegistrationDependencyGraph,
  useFormStateMachine,
  type ValidationTarget,
} from "@/src/services/formStateMachine";
import {
  validateRegistrationData,
  type FormValidationRequest,
  type FormValidationResponse,
} from "@/src/services/formValidator.worker";
import {
  FORM_STEPS,
  createEmptyProductRegistration,
  type FormStep,
  type ProductRegistration,
} from "@/src/types/registration";

export interface UseFormWizardOptions {
  productId: string;
  initialData?: ProductRegistration;
  onSubmit?: (data: ProductRegistration) => Promise<void> | void;
  createValidatorWorker?: () => Worker;
}

export function useFormWizard({
  productId,
  initialData,
  onSubmit,
  createValidatorWorker,
}: UseFormWizardOptions) {
  const registrationDependencyGraph = useMemo(
    () => getRegistrationDependencyGraph(),
    []
  );
  const startingData = useMemo(
    () => initialData ?? createEmptyProductRegistration(productId),
    [initialData, productId]
  );
  const [state, dispatch] = useFormStateMachine<ProductRegistration>({
    productId,
    initialData: startingData,
    dependencyGraph: registrationDependencyGraph,
  });

  const workerRef = useRef<Worker | null>(null);
  const pendingValidationsRef = useRef(
    new Map<
      string,
      {
        resolve: (errors: FormValidationResponse["errors"]) => void;
        reject: (error: Error) => void;
      }
    >()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const workerFactory =
      createValidatorWorker ??
      (() =>
        new Worker(new URL("../services/formValidator.worker.ts", import.meta.url), {
          type: "module",
        }));

    let worker: Worker;
    try {
      worker = workerFactory();
    } catch {
      return;
    }

    workerRef.current = worker;
    const pendingValidations = pendingValidationsRef.current;

    const handleMessage = (event: MessageEvent<FormValidationResponse>) => {
      const pending = pendingValidations.get(event.data.id);
      if (!pending) return;
      pending.resolve(event.data.errors);
      pendingValidations.delete(event.data.id);
    };

    const handleError = () => {
      const error = new Error("Validation worker failed");
      for (const pending of pendingValidations.values()) {
        pending.reject(error);
      }
      pendingValidations.clear();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      workerRef.current = null;
      pendingValidations.clear();
    };
  }, [createValidatorWorker]);

  const runWorkerValidation = useCallback(
    (step: ValidationTarget): Promise<FormValidationResponse["errors"]> => {
      if (typeof window === "undefined") {
        return Promise.resolve(validateRegistrationData(state.data, step));
      }

      const worker = workerRef.current;
      if (!worker) {
        return Promise.reject(new Error("Validation worker is unavailable"));
      }

      const id = crypto.randomUUID();
      const message: FormValidationRequest = {
        id,
        data: state.data,
        step,
      };

      return new Promise((resolve, reject) => {
        pendingValidationsRef.current.set(id, { resolve, reject });
        worker.postMessage(message);
      });
    },
    [state.data]
  );

  const validateStep = useCallback(
    async (step: ValidationTarget, nextStep?: FormStep): Promise<boolean> => {
      dispatch({ type: "VALIDATE_STEP", step });

      try {
        const errors = await runWorkerValidation(step);
        if (errors.length > 0) {
          dispatch({ type: "VALIDATION_FAILED", errors });
          return false;
        }

        dispatch({ type: "VALIDATION_PASSED", nextStep });
        return true;
      } catch (error) {
        dispatch({
          type: "VALIDATION_FAILED",
          errors: [
            {
              field: "_form",
              message:
                error instanceof Error
                  ? error.message
                  : "Validation failed unexpectedly",
            },
          ],
        });
        return false;
      }
    },
    [dispatch, runWorkerValidation]
  );

  const updateField = useCallback(
    <TField extends keyof ProductRegistration & string>(
      field: TField,
      value: ProductRegistration[TField]
    ) => {
      dispatch({ type: "FIELD_CHANGED", field, value });
    },
    [dispatch]
  );

  const currentStepIndex = FORM_STEPS.indexOf(state.currentStep);

  const nextStep = useCallback(async (): Promise<boolean> => {
    const next = FORM_STEPS[currentStepIndex + 1];
    if (!next) return validateStep(state.currentStep);
    return validateStep(state.currentStep, next);
  }, [currentStepIndex, state.currentStep, validateStep]);

  const previousStep = useCallback(() => {
    const previous = FORM_STEPS[currentStepIndex - 1];
    if (previous) {
      dispatch({ type: "SET_STEP", step: previous });
    }
  }, [currentStepIndex, dispatch]);

  const submit = useCallback(async (): Promise<boolean> => {
    const valid = await validateStep("all");
    if (!valid) return false;

    dispatch({ type: "SUBMIT" });
    try {
      await onSubmit?.(state.data);
      await deleteFormDraft(productId);
      dispatch({ type: "SUBMIT_SUCCEEDED" });
      return true;
    } catch (error) {
      dispatch({
        type: "SUBMIT_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Submission failed. Your draft remains saved.",
      });
      return false;
    }
  }, [dispatch, onSubmit, productId, state.data, validateStep]);

  const recoverDraft = useCallback(() => {
    dispatch({ type: "DRAFT_ACCEPTED" });
  }, [dispatch]);

  const discardDraft = useCallback(async () => {
    await deleteFormDraft(productId);
    dispatch({ type: "DRAFT_DISMISSED" });
  }, [dispatch, productId]);

  const start = useCallback(() => {
    dispatch({ type: "START_FILLING" });
  }, [dispatch]);

  return {
    state,
    status: state.status,
    data: state.data,
    errors: state.errors,
    currentStep: state.currentStep,
    currentStepIndex,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === FORM_STEPS.length - 1,
    draft: state.draft,
    updateField,
    validateStep,
    nextStep,
    previousStep,
    submit,
    recoverDraft,
    discardDraft,
    start,
  };
}
