"use client";

import type {
  FieldError,
  ProductRegistration,
  RegistrationField,
} from "@/src/types/registration";

interface StepBasicInfoProps {
  data: ProductRegistration;
  errors: FieldError[];
  onChange: <TField extends RegistrationField>(
    field: TField,
    value: ProductRegistration[TField]
  ) => void;
}

export function StepBasicInfo({ data, errors, onChange }: StepBasicInfoProps) {
  return (
    <fieldset>
      <legend>Basic info</legend>
      <TextField
        id="productName"
        label="Product name"
        value={data.productName}
        error={getFieldError(errors, "productName")}
        onChange={(value) => onChange("productName", value)}
      />
      <TextField
        id="productType"
        label="Product type"
        value={data.productType}
        error={getFieldError(errors, "productType")}
        onChange={(value) => onChange("productType", value)}
      />
      <NumberField
        id="quantity"
        label="Quantity"
        value={data.quantity}
        error={getFieldError(errors, "quantity")}
        onChange={(value) => onChange("quantity", value)}
      />
      <TextField
        id="unit"
        label="Unit"
        value={data.unit}
        error={getFieldError(errors, "unit")}
        onChange={(value) => onChange("unit", value)}
      />
      <TextField
        id="farmName"
        label="Farm name"
        value={data.farmName}
        error={getFieldError(errors, "farmName")}
        onChange={(value) => onChange("farmName", value)}
      />
      <DateField
        id="harvestDate"
        label="Harvest date"
        value={data.harvestDate}
        error={getFieldError(errors, "harvestDate")}
        onChange={(value) => onChange("harvestDate", value)}
      />
      <NumberField
        id="pricePerUnit"
        label="Price per unit"
        value={data.pricePerUnit}
        error={getFieldError(errors, "pricePerUnit")}
        onChange={(value) => onChange("pricePerUnit", value)}
      />
      <output htmlFor="quantity pricePerUnit">Total value: {data.totalValue}</output>
    </fieldset>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: RegistrationField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        name={id}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span id={`${id}-error`}>{error}</span> : null}
    </label>
  );
}

function DateField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: RegistrationField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        name={id}
        type="date"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span id={`${id}-error`}>{error}</span> : null}
    </label>
  );
}

function NumberField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: RegistrationField;
  label: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        name={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
      {error ? <span id={`${id}-error`}>{error}</span> : null}
    </label>
  );
}

function getFieldError(errors: FieldError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}
