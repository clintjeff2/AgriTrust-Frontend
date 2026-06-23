"use client";

import { useEffect } from "react";
import { useFormWizard } from "@/src/hooks/useFormWizard";
import { StepBasicInfo } from "@/src/components/registration/steps/StepBasicInfo";
import { StepCertification } from "@/src/components/registration/steps/StepCertification";
import type { ProductRegistration } from "@/src/types/registration";

interface ProductRegistrationWizardProps {
  productId: string;
  initialData?: ProductRegistration;
  onSubmit?: (data: ProductRegistration) => Promise<void> | void;
}

export function ProductRegistrationWizard({
  productId,
  initialData,
  onSubmit,
}: ProductRegistrationWizardProps) {
  const wizard = useFormWizard({ productId, initialData, onSubmit });
  const { start, status } = wizard;

  useEffect(() => {
    if (status === "IDLE") {
      start();
    }
  }, [start, status]);

  const formError = wizard.errors.find((error) => error.field === "_form");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void wizard.submit();
      }}
    >
      {wizard.status === "DRAFT_RECOVERED" ? (
        <section aria-live="polite">
          <p>Saved draft found.</p>
          <button type="button" onClick={wizard.recoverDraft}>
            Restore
          </button>
          <button
            type="button"
            onClick={() => {
              void wizard.discardDraft();
            }}
          >
            Discard
          </button>
        </section>
      ) : null}

      {wizard.currentStep === "basic-info" ? (
        <StepBasicInfo
          data={wizard.data}
          errors={wizard.errors}
          onChange={wizard.updateField}
        />
      ) : null}

      {wizard.currentStep === "certification" ? (
        <StepCertification
          data={wizard.data}
          errors={wizard.errors}
          onChange={wizard.updateField}
        />
      ) : null}

      {wizard.currentStep === "review" ? (
        <fieldset>
          <legend>Review</legend>
          <dl>
            <dt>Product</dt>
            <dd>{wizard.data.productName}</dd>
            <dt>Quantity</dt>
            <dd>
              {wizard.data.quantity} {wizard.data.unit}
            </dd>
            <dt>Total value</dt>
            <dd>{wizard.data.totalValue}</dd>
            <dt>Certification</dt>
            <dd>{wizard.data.certificationType}</dd>
          </dl>
          <label htmlFor="termsAccepted">
            <input
              id="termsAccepted"
              name="termsAccepted"
              type="checkbox"
              checked={wizard.data.termsAccepted}
              aria-invalid={wizard.errors.some(
                (error) => error.field === "termsAccepted"
              )}
              onChange={(event) =>
                wizard.updateField("termsAccepted", event.target.checked)
              }
            />
            Terms accepted
          </label>
          {wizard.errors
            .filter((error) => error.step === "review")
            .map((error) => (
              <p key={`${error.field}-${error.message}`}>{error.message}</p>
            ))}
        </fieldset>
      ) : null}

      {formError ? <p role="alert">{formError.message}</p> : null}
      {wizard.state.error && !formError ? (
        <p role="alert">{wizard.state.error}</p>
      ) : null}

      <nav aria-label="Registration steps">
        <button
          type="button"
          disabled={wizard.isFirstStep || wizard.status === "SUBMITTING"}
          onClick={wizard.previousStep}
        >
          Back
        </button>
        {!wizard.isLastStep ? (
          <button
            type="button"
            disabled={wizard.status === "VALIDATING"}
            onClick={() => {
              void wizard.nextStep();
            }}
          >
            Next
          </button>
        ) : (
          <button type="submit" disabled={wizard.status === "SUBMITTING"}>
            Submit
          </button>
        )}
      </nav>
    </form>
  );
}
