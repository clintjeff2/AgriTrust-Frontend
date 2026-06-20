import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SafeText } from "@/src/components/common/SafeText";

const XSS_PAYLOAD = "<script>alert('xss')</script>";

describe("SafeText", () => {
  describe("default (React-escaped) rendering", () => {
    it("renders plain text without modification", () => {
      render(<SafeText>Maize - Grade A</SafeText>);
      expect(screen.getByText("Maize - Grade A")).toBeTruthy();
    });

    it("does not inject a <script> element when given an XSS payload", () => {
      render(<SafeText>{XSS_PAYLOAD}</SafeText>);
      expect(document.querySelector("script")).toBeNull();
    });

    it("renders the payload as inert visible text, not executable markup", () => {
      const { container } = render(<SafeText>{XSS_PAYLOAD}</SafeText>);
      expect(container.textContent).toBe(XSS_PAYLOAD);
      expect(container.innerHTML).not.toContain("<script>");
    });
  });

  describe("asHtml rendering", () => {
    it("entity-encodes < and > so no script element is created", () => {
      render(<SafeText asHtml>{XSS_PAYLOAD}</SafeText>);
      expect(document.querySelector("script")).toBeNull();
    });

    it("encodes & < > to safe entities (XSS-critical characters)", () => {
      const { container } = render(
        <SafeText asHtml>{"& < >"}</SafeText>,
      );
      const html = container.innerHTML;
      expect(html).toContain("&amp;");
      expect(html).toContain("&lt;");
      expect(html).toContain("&gt;");
    });

    it("does not allow raw < or > to survive into the DOM", () => {
      const { container } = render(
        <SafeText asHtml>{'before <b>bold</b> after'}</SafeText>,
      );
      expect(container.querySelector("b")).toBeNull();
      expect(container.innerHTML).toContain("&lt;");
    });

    it("preserves the literal text content after encoding", () => {
      render(<SafeText asHtml>Hello World</SafeText>);
      expect(screen.getByText("Hello World")).toBeTruthy();
    });
  });
});
