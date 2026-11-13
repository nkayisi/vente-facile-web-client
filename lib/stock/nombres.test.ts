/**
 * La lecture d'un nombre tapé : copie tenue à la main de
 * `mobile/vf-marchand/src/data/nombres.ts`. Ces cas sont CEUX du terminal : si
 * l'une des deux copies change de règle, l'un des deux jeux de tests tombe.
 */
import { describe, expect, it } from "vitest";

import { lireNombre } from "./nombres";

const valeur = (s: string): number | null => {
  const r = lireNombre(s);
  if (!r.ok) throw new Error(`refusé : ${r.motif}`);
  return r.valeur;
};

describe("lireNombre", () => {
  it("lit la VIRGULE française", () => {
    expect(valeur("12,5")).toBe(12.5);
    expect(valeur("12.5")).toBe(12.5);
  });

  it("lit les séparateurs de milliers, espaces insécables comprises", () => {
    expect(valeur("12 500")).toBe(12500);
    expect(valeur("12 500")).toBe(12500);
    expect(valeur("12 500,50")).toBe(12500.5);
  });

  it("rend `null` sur une saisie VIDE, jamais zéro", () => {
    expect(valeur("")).toBeNull();
    expect(valeur("   ")).toBeNull();
  });

  it("rend zéro quand il est ÉCRIT", () => {
    expect(valeur("0")).toBe(0);
    expect(valeur("0,00")).toBe(0);
  });

  it("nomme le motif du refus", () => {
    expect(lireNombre("-500")).toEqual({ ok: false, motif: "negatif" });
    for (const saisie of ["abc", "12,5,5", "1.2.3", ",", "12$"]) {
      expect(lireNombre(saisie)).toEqual({ ok: false, motif: "illisible" });
    }
  });

  it("ne DEVINE pas une virgule de milliers", () => {
    // « 12,500 » vaut douze et demi en français.
    expect(valeur("12,500")).toBe(12.5);
  });
});
