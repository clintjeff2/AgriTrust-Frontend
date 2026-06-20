"use client";

import { sanitizeForDisplay } from "@/src/utils/sanitizer";

interface SafeTextProps {
  children: string;
  asHtml?: boolean;
}

export function SafeText({ children, asHtml = false }: SafeTextProps) {
  if (asHtml) {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: sanitizeForDisplay(children) }}
      />
    );
  }

  return <>{children}</>;
}
