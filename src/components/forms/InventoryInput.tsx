"use client";

import { useState } from "react";
import { sanitizeText } from "@/src/utils/sanitizer";

interface InventoryInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function InventoryInput({
  label,
  value,
  onChange,
  placeholder,
  id,
}: InventoryInputProps) {
  const [fieldValue, setFieldValue] = useState(value);

  const handleBlur = () => {
    const sanitized = sanitizeText(fieldValue.trim());
    setFieldValue(sanitized);
    onChange(sanitized);
  };

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={fieldValue}
        onChange={(e) => setFieldValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
      />
    </div>
  );
}
