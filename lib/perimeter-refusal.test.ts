import { describe, expect, it } from "vitest";

import { codeDeRefus, doitRelireLesDroits, messageDeRefus } from "./perimeter-refusal";

describe("doitRelireLesDroits", () => {
  it.each(["consultation_seule", "entrepot_inactif", "stock_insuffisant"])(
    "relit sur un refus %s, porté par le corps d'erreur",
    (code) => {
      expect(doitRelireLesDroits({ success: false, errors: { detail: "x", code } })).toBe(true);
    },
  );

  it("relit sur un code relevé par la server action", () => {
    expect(doitRelireLesDroits({ success: false, code: "consultation_seule" })).toBe(true);
  });

  it("ne relit pas sur un refus qui ne parle pas du périmètre", () => {
    expect(doitRelireLesDroits({ success: false, errors: { name: ["Requis."] } })).toBe(false);
    expect(doitRelireLesDroits({ success: false, code: "session_d_un_autre" })).toBe(false);
  });

  it("ne relit jamais sur un succès, même si un code traîne", () => {
    expect(doitRelireLesDroits({ success: true, code: "consultation_seule" })).toBe(false);
  });
});

describe("codeDeRefus", () => {
  it("préfère le code relevé à celui du corps", () => {
    expect(
      codeDeRefus({ success: false, code: "entrepot_inactif", errors: { code: "autre" } }),
    ).toBe("entrepot_inactif");
  });
});

describe("messageDeRefus", () => {
  it("nomme le champ refusé", () => {
    expect(
      messageDeRefus({ success: false, errors: { warehouse: ["Hors de votre périmètre."] } }),
    ).toBe("Hors de votre périmètre.");
  });

  it("rend null sur un succès", () => {
    expect(messageDeRefus({ success: true })).toBeNull();
  });
});
