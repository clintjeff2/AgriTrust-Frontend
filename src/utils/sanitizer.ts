import DOMPurify from "dompurify";

const ALLOWED_CHARS = /[^a-zA-Z0-9 \-,.():/]/g;

export function sanitizeText(input: string): string {
  const stripped = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return stripped.replace(ALLOWED_CHARS, "");
}

const ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

export function sanitizeForDisplay(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => ENTITY_MAP[ch]);
}
