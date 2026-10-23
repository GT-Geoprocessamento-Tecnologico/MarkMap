import { describe, expect, it } from "vitest";
import { ApiError, isConflict, toUserMessage } from "../lib/errors";

describe("ApiError", () => {
  it("mapeia o code para estado e mensagem do usuario", () => {
    const conflict = new ApiError({
      code: "VERSION_CONFLICT",
      message: "stale version",
      status: 409,
      requestId: "4b1f0f0e-0000-4000-8000-000000000001",
    });
    expect(isConflict(conflict)).toBe(true);
    expect(toUserMessage(conflict)).toContain("outra sessão");
    expect(toUserMessage(new Error("boom"))).toBe(
      "Erro inesperado. Tente novamente.",
    );

    const futureCode = new ApiError({
      code: "FUTURE_CODE",
      message: "mensagem da API",
      status: 400,
    });
    expect(toUserMessage(futureCode)).toBe("mensagem da API");
  });
});
