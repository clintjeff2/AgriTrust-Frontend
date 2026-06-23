import type {
  FieldError,
  FormStep,
  ProductRegistration,
} from "@/src/types/registration";

export type ValidationScope = FormStep | "all";

export interface FormValidationRequest {
  id: string;
  data: ProductRegistration;
  step: ValidationScope;
}

export interface FormValidationResponse {
  id: string;
  errors: FieldError[];
}

export function validateRegistrationData(
  data: ProductRegistration,
  step: ValidationScope = "all"
): FieldError[] {
  const errors: FieldError[] = [];

  if (step === "basic-info" || step === "all") {
    if (!data.productName.trim()) {
      errors.push({
        field: "productName",
        message: "Product name is required",
        step: "basic-info",
      });
    }

    if (!data.productType.trim()) {
      errors.push({
        field: "productType",
        message: "Product type is required",
        step: "basic-info",
      });
    }

    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      errors.push({
        field: "quantity",
        message: "Quantity must be greater than 0",
        step: "basic-info",
      });
    }

    if (!data.unit.trim()) {
      errors.push({
        field: "unit",
        message: "Unit is required",
        step: "basic-info",
      });
    }

    if (!data.farmName.trim()) {
      errors.push({
        field: "farmName",
        message: "Farm name is required",
        step: "basic-info",
      });
    }

    if (!data.harvestDate.trim()) {
      errors.push({
        field: "harvestDate",
        message: "Harvest date is required",
        step: "basic-info",
      });
    }

    if (!Number.isFinite(data.pricePerUnit) || data.pricePerUnit < 0) {
      errors.push({
        field: "pricePerUnit",
        message: "Price per unit cannot be negative",
        step: "basic-info",
      });
    }
  }

  if (step === "certification" || step === "all") {
    if (!data.certificationType.trim()) {
      errors.push({
        field: "certificationType",
        message: "Certification type is required",
        step: "certification",
      });
    }

    if (data.certificationType !== "none") {
      if (!data.certifierName.trim()) {
        errors.push({
          field: "certifierName",
          message: "Certifier name is required",
          step: "certification",
        });
      }

      if (!data.certificateId.trim()) {
        errors.push({
          field: "certificateId",
          message: "Certificate ID is required",
          step: "certification",
        });
      }

      if (data.certificateExpiry) {
        const expiry = new Date(`${data.certificateExpiry}T00:00:00`);
        if (Number.isNaN(expiry.getTime())) {
          errors.push({
            field: "certificateExpiry",
            message: "Certificate expiry date is invalid",
            step: "certification",
          });
        }
      }
    }
  }

  if (step === "review" || step === "all") {
    if (!data.termsAccepted) {
      errors.push({
        field: "termsAccepted",
        message: "Terms must be accepted before submission",
        step: "review",
      });
    }
  }

  return errors;
}

if (
  typeof window === "undefined" &&
  typeof globalThis.addEventListener === "function" &&
  typeof globalThis.postMessage === "function"
) {
  globalThis.addEventListener(
    "message",
    (event: MessageEvent<FormValidationRequest>) => {
      const { id, data, step } = event.data;
      const response: FormValidationResponse = {
        id,
        errors: validateRegistrationData(data, step),
      };

      globalThis.postMessage(response);
    }
  );
}
