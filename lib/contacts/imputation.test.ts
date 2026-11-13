/**
 * L'imputation annoncée d'un règlement client : copie tenue à la main de
 * `mobile/vf-marchand/src/features/clients/imputation.ts`, mêmes cas.
 */
import { describe, expect, it } from "vitest";

import { detteNonVisible, imputer, montantAjustement } from "./imputation";

const f = (reference: string, resteAPayer: number) => ({ reference, resteAPayer });

describe("imputer", () => {
  it("solde les factures les plus anciennes d'abord", () => {
    const r = imputer(150, [f("VT-1", 100), f("VT-2", 100)]);
    expect(r.soldees).toEqual(["VT-1"]);
    expect(r.partielle).toBe("VT-2");
    expect(r.avance).toBe(0);
  });

  it("le reliquat devient une avance", () => {
    expect(imputer(250, [f("VT-1", 100), f("VT-2", 100)])).toEqual({
      soldees: ["VT-1", "VT-2"],
      partielle: null,
      avance: 50,
    });
  });

  it("une facture au reste nul est SAUTÉE", () => {
    expect(imputer(100, [f("VT-DEJA", 0), f("VT-1", 100)]).soldees).toEqual(["VT-1"]);
  });

  it("un centième résiduel ne fabrique pas une facture partielle", () => {
    const r = imputer(99.99, [f("VT-1", 33.33), f("VT-2", 33.33), f("VT-3", 33.33)]);
    expect(r.partielle).toBeNull();
    expect(r.avance).toBe(0);
  });

  it("un versement nul n'impute rien", () => {
    expect(imputer(0, [f("VT-1", 100)])).toEqual({ soldees: [], partielle: null, avance: 0 });
  });
});

describe("montantAjustement", () => {
  it("le SENS décide, jamais le signe saisi", () => {
    expect(montantAjustement("augmenter", 500)).toBe(500);
    expect(montantAjustement("augmenter", -500)).toBe(500);
    expect(montantAjustement("reduire", 500)).toBe(-500);
  });
});

describe("detteNonVisible", () => {
  it("zéro quand les factures expliquent toute la dette", () => {
    expect(detteNonVisible(200, [f("VT-1", 120), f("VT-2", 80)])).toBe(0);
  });

  it("l'écart que les factures n'expliquent pas", () => {
    expect(detteNonVisible(204, [f("VT-1", 200)])).toBe(4);
  });
});
