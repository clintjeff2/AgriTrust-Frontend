export const FORM_STEPS = ["basic-info", "certification", "review"] as const;

export type FormStep = (typeof FORM_STEPS)[number];

export interface FieldError {
  field: string;
  message: string;
  step?: FormStep;
}

export interface ProductRegistration {
  productId: string;
  productName: string;
  productType: string;
  quantity: number;
  unit: string;
  farmName: string;
  harvestDate: string;
  certificationType: string;
  certifierName: string;
  certificateId: string;
  certificateExpiry: string;
  pricePerUnit: number;
  totalValue: number;
  termsAccepted: boolean;
}

export type RegistrationField = keyof ProductRegistration & string;

export const STEP_FIELDS: Record<FormStep, RegistrationField[]> = {
  "basic-info": [
    "productName",
    "productType",
    "quantity",
    "unit",
    "farmName",
    "harvestDate",
    "pricePerUnit",
    "totalValue",
  ],
  certification: [
    "certificationType",
    "certifierName",
    "certificateId",
    "certificateExpiry",
  ],
  review: ["termsAccepted"],
};

export function createEmptyProductRegistration(
  productId: string
): ProductRegistration {
  return {
    productId,
    productName: "",
    productType: "",
    quantity: 0,
    unit: "",
    farmName: "",
    harvestDate: "",
    certificationType: "none",
    certifierName: "",
    certificateId: "",
    certificateExpiry: "",
    pricePerUnit: 0,
    totalValue: 0,
    termsAccepted: false,
  };
}
