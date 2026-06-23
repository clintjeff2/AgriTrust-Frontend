"use client";

import type {
  FieldError,
  ProductRegistration,
  RegistrationField,
} from "@/src/types/registration";

interface StepCertificationProps {
  data: ProductRegistration;
  errors: FieldError[];
  onChange: <TField extends RegistrationField>(
    field: TField,
    value: ProductRegistration[TField]
  ) => void;
}

export function StepCertification({
  data,
  errors,
  onChange,
}: StepCertificationProps) {
  const requiresCertificate = data.certificationType !== "none";

  return (
    <fieldset>
      <legend>Certification</legend>
      <label htmlFor="certificationType">
        Certification type
        <select
          id="certificationType"
          name="certificationType"
          value={data.certificationType}
          aria-invalid={Boolean(getFieldError(errors, "certificationType"))}
          onChange={(event) =>
            onChange("certificationType", event.target.value)
          }
        >
          <option value="none">None</option>
          <option value="organic">Organic</option>
          <option value="fair-trade">Fair trade</option>
          <option value="regenerative">Regenerative</option>
        </select>
      </label>
      <TextField
        id="certifierName"
        label="Certifier name"
        value={data.certifierName}
        disabled={!requiresCertificate}
        error={getFieldError(errors, "certifierName")}
        onChange={(value) => onChange("certifierName", value)}
      />
      <TextField
        id="certificateId"
        label="Certificate ID"
        value={data.certificateId}
        disabled={!requiresCertificate}
        error={getFieldError(errors, "certificateId")}
        onChange={(value) => onChange("certificateId", value)}
      />
      <label htmlFor="certificateExpiry">
        Expiry
        <input
          id="certificateExpiry"
          name="certificateExpiry"
          type="date"
          value={data.certificateExpiry}
          disabled={!requiresCertificate}
          aria-invalid={Boolean(getFieldError(errors, "certificateExpiry"))}
          onChange={(event) =>
            onChange("certificateExpiry", event.target.value)
          }
        />
        {getFieldError(errors, "certificateExpiry") ? (
          <span id="certificateExpiry-error">
            {getFieldError(errors, "certificateExpiry")}
          </span>
        ) : null}
      </label>
    </fieldset>
  );
}

function TextField({
  id,
  label,
  value,
  disabled,
  error,
  onChange,
}: {
  id: RegistrationField;
  label: string;
  value: string;
  disabled: boolean;
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
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span id={`${id}-error`}>{error}</span> : null}
    </label>
  );
}

function getFieldError(errors: FieldError[], field: string): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}
