// Desenvolvido por MtsFerreira. Crédito e versão têm uma única fonte.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { version } from "../../package.json";
import AppFooter from "../components/AppFooter";

describe("crédito do MarkMap", () => {
  it("mostra autor e versão do pacote lado a lado", () => {
    render(<AppFooter />);
    const link = screen.getByRole("link", { name: "MtsFerreira" });
    expect(link).toHaveAttribute("href", "https://mtsferreira.dev");
    expect(link.closest("footer")).toHaveTextContent(`Desenvolvido por MtsFerreira · v${version}`);
  });
});
