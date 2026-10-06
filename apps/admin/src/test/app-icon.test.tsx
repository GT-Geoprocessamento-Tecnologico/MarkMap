import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppIcon } from "../components/AppIcon";

describe("AppIcon", () => {
  it("renders menu icons as self-contained SVG instead of font or emoji glyphs", () => {
    const { container } = render(<AppIcon name="map" size="lg" />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(container.textContent).toBe("");
  });

  it("keeps semantic color inherited from the surrounding menu state", () => {
    const { container } = render(
      <span className="text-primary">
        <AppIcon name="settings" />
      </span>,
    );

    expect(container.querySelector("svg")).toHaveClass("markmap-app-icon");
  });
});
