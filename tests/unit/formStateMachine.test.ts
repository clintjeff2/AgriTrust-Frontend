import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FORM_AUTO_SAVE_DEBOUNCE_MS,
  createDependencyGraph,
  createInitialFormState,
  formStateReducer,
  recomputeDependents,
} from "@/src/services/formStateMachine";
import {
  deleteFormDraft,
  listFormDrafts,
  loadFormDraft,
  saveFormDraft,
  _resetFormDraftDbForTests,
} from "@/src/services/cache";
import { validateRegistrationData } from "@/src/services/formValidator.worker";
import type { ProductRegistration } from "@/src/types/registration";

const baseRegistration: ProductRegistration = {
  productId: "product-1",
  productName: "Organic wheat",
  productType: "grain",
  quantity: 20,
  unit: "kg",
  farmName: "North field",
  harvestDate: "2026-06-01",
  certificationType: "organic",
  certifierName: "AgriCert",
  certificateId: "CERT-123",
  certificateExpiry: "2027-06-01",
  pricePerUnit: 5,
  totalValue: 100,
  termsAccepted: true,
};

describe("formStateMachine", () => {
  beforeEach(() => {
    vi.useRealTimers();
    _resetFormDraftDbForTests();
    indexedDB.deleteDatabase("agritrust-form-cache");
  });

  it("walks all wizard state transition paths", () => {
    let state = createInitialFormState(baseRegistration.productId, baseRegistration);

    expect(state.status).toBe("IDLE");

    state = formStateReducer(state, { type: "START_FILLING" });
    expect(state.status).toBe("FILLING");

    state = formStateReducer(state, {
      type: "FIELD_CHANGED",
      field: "productName",
      value: "Organic corn",
    });
    expect(state.status).toBe("FILLING");
    expect(state.data.productName).toBe("Organic corn");
    expect(state.dirty).toBe(true);

    state = formStateReducer(state, {
      type: "VALIDATE_STEP",
      step: "basic-info",
    });
    expect(state.status).toBe("VALIDATING");
    expect(state.validatingStep).toBe("basic-info");

    state = formStateReducer(state, {
      type: "VALIDATION_FAILED",
      errors: [{ field: "productName", message: "Required", step: "basic-info" }],
    });
    expect(state.status).toBe("ERROR");
    expect(state.errors).toHaveLength(1);

    state = formStateReducer(state, { type: "START_FILLING" });
    state = formStateReducer(state, {
      type: "VALIDATE_STEP",
      step: "basic-info",
    });
    state = formStateReducer(state, {
      type: "VALIDATION_PASSED",
      nextStep: "certification",
    });
    expect(state.status).toBe("FILLING");
    expect(state.currentStep).toBe("certification");
    expect(state.errors).toEqual([]);

    state = formStateReducer(state, { type: "SUBMIT" });
    expect(state.status).toBe("SUBMITTING");

    state = formStateReducer(state, {
      type: "SUBMIT_FAILED",
      error: "Network interrupted",
    });
    expect(state.status).toBe("ERROR");
    expect(state.error).toBe("Network interrupted");

    state = formStateReducer(state, { type: "SUBMIT" });
    state = formStateReducer(state, { type: "SUBMIT_SUCCEEDED" });
    expect(state.status).toBe("SUCCESS");

    state = formStateReducer(state, {
      type: "DRAFT_FOUND",
      draft: {
        key: "form-draft-product-1",
        productId: "product-1",
        data: { ...baseRegistration, productName: "Recovered wheat" },
        currentStep: "certification",
        updatedAt: 100,
      },
    });
    expect(state.status).toBe("DRAFT_RECOVERED");

    state = formStateReducer(state, { type: "DRAFT_ACCEPTED" });
    expect(state.status).toBe("FILLING");
    expect(state.currentStep).toBe("certification");
    expect(state.data.productName).toBe("Recovered wheat");

    state = formStateReducer(state, {
      type: "DRAFT_FOUND",
      draft: {
        key: "form-draft-product-1",
        productId: "product-1",
        data: baseRegistration,
        currentStep: "basic-info",
        updatedAt: 101,
      },
    });
    state = formStateReducer(state, { type: "DRAFT_DISMISSED" });
    expect(state.status).toBe("IDLE");
  });

  it("recomputes transitive field dependencies in dependency order", () => {
    const graph = createDependencyGraph<ProductRegistration>([
      {
        field: "totalValue",
        dependsOn: ["quantity", "pricePerUnit"],
        compute: (data) => data.quantity * data.pricePerUnit,
      },
      {
        field: "certificateId",
        dependsOn: ["totalValue"],
        compute: (data) => `VALUE-${data.totalValue}`,
      },
    ]);

    const result = recomputeDependents(
      { ...baseRegistration, quantity: 30 },
      "quantity",
      graph
    );

    expect(result.data.totalValue).toBe(150);
    expect(result.data.certificateId).toBe("VALUE-150");
    expect(result.recomputedFields).toEqual(["totalValue", "certificateId"]);
  });

  it("rejects dependency graphs larger than 50 fields", () => {
    expect(() =>
      createDependencyGraph(
        Array.from({ length: 51 }, (_, index) => ({
          field: `field-${index}`,
          dependsOn: [],
          compute: () => index,
        }))
      )
    ).toThrow("Field dependency graph supports a maximum of 50 fields");
  });

  it("persists drafts by product key and retains only the newest ten", async () => {
    expect(FORM_AUTO_SAVE_DEBOUNCE_MS).toBe(2000);

    for (let index = 0; index < 11; index += 1) {
      await saveFormDraft({
        productId: `product-${index}`,
        data: { ...baseRegistration, productId: `product-${index}` },
        currentStep: "basic-info",
        updatedAt: index,
      });
    }

    const drafts = await listFormDrafts<ProductRegistration>();
    expect(drafts).toHaveLength(10);
    expect(drafts.map((draft) => draft.productId)).not.toContain("product-0");
    expect(await loadFormDraft<ProductRegistration>("product-10")).toMatchObject({
      key: "form-draft-product-10",
      productId: "product-10",
    });

    await deleteFormDraft("product-10");
    expect(await loadFormDraft<ProductRegistration>("product-10")).toBeUndefined();
  });

  it("validates registration data with step-scoped worker-safe rules", () => {
    expect(
      validateRegistrationData({
        ...baseRegistration,
        productName: "",
        quantity: 0,
      }, "basic-info")
    ).toEqual([
      { field: "productName", message: "Product name is required", step: "basic-info" },
      { field: "quantity", message: "Quantity must be greater than 0", step: "basic-info" },
    ]);

    expect(
      validateRegistrationData({
        ...baseRegistration,
        certificationType: "organic",
        certifierName: "",
        certificateId: "",
      }, "certification")
    ).toEqual([
      { field: "certifierName", message: "Certifier name is required", step: "certification" },
      { field: "certificateId", message: "Certificate ID is required", step: "certification" },
    ]);

    expect(
      validateRegistrationData({
        ...baseRegistration,
        termsAccepted: false,
      }, "all")
    ).toContainEqual({
      field: "termsAccepted",
      message: "Terms must be accepted before submission",
      step: "review",
    });
  });
});
