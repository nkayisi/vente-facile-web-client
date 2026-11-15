import { describe, expect, it } from "vitest";

import { codeDuCorps, formatApiErrorBody } from "./drf-error";

describe("formatApiErrorBody", () => {
  it("ne lit jamais le code d'un refus comme un champ", () => {
    const message = formatApiErrorBody(
      {
        register: ["Cette caisse appartient à la session de Jean."],
        code: "session_d_un_autre",
      },
      "repli",
    );
    expect(message).toBe("Cette caisse appartient à la session de Jean.");
    expect(message).not.toContain("code");
    expect(message).not.toContain("session_d_un_autre");
  });

  it("garde le nom du champ sur une erreur ordinaire, sans code", () => {
    expect(
      formatApiErrorBody({ earn_percent: ["Un nombre valide est requis."] }, "repli"),
    ).toBe("earn_percent : Un nombre valide est requis.");
  });

  it("préfère le detail d'un 403 nommé", () => {
    expect(
      formatApiErrorBody(
        { detail: "L'entrepôt Nord ne vous est pas assigné.", code: "consultation_seule" },
        "repli",
      ),
    ).toBe("L'entrepôt Nord ne vous est pas assigné.");
  });

  it("ignore aussi le code quand l'erreur est imbriquée", () => {
    const message = formatApiErrorBody(
      { items: [{ quantity: ["Stock insuffisant."] }], code: "stock_insuffisant" },
      "repli",
    );
    expect(message).toContain("Stock insuffisant.");
    expect(message).not.toContain("stock_insuffisant");
  });

  it("ne rend pas la liste des champs d'un refus réservé au propriétaire", () => {
    const message = formatApiErrorBody(
      { detail: "Réservé au propriétaire.", code: "reserve_au_proprietaire", fields: ["is_active"] },
      "repli",
    );
    expect(message).toBe("Réservé au propriétaire.");
  });
});

describe("codeDuCorps", () => {
  it("lit le code au premier niveau", () => {
    expect(codeDuCorps({ warehouse: ["x"], code: "entrepot_inactif" })).toBe("entrepot_inactif");
  });

  it("lit le code sous detail", () => {
    expect(codeDuCorps({ detail: { code: "subscription_required" } })).toBe("subscription_required");
  });

  it("rend undefined sans code", () => {
    expect(codeDuCorps({ name: ["Requis."] })).toBeUndefined();
    expect(codeDuCorps(undefined)).toBeUndefined();
    expect(codeDuCorps(["x"])).toBeUndefined();
  });
});
