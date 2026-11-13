/**
 * L'entrepôt d'une dépense saisie au back-office : miroir de
 * `mobile/vf-marchand/src/features/caisse/perimetre.ts`.
 */
import { describe, expect, it } from "vitest";

import {
  depenseSeraitInvisible,
  entrepotParDefaut,
  peutNeRattacherAucunDepot,
  saisieSansIssue,
} from "./entrepot-depense";

const W = (id: string, is_default = false) => ({ id, name: id, is_default });

describe("entrepotParDefaut", () => {
  it("le principal, sinon l'unique", () => {
    expect(entrepotParDefaut([W("a"), W("b", true)])).toBe("b");
    expect(entrepotParDefaut([W("a")])).toBe("a");
  });

  it("entre plusieurs dépôts sans principal, ne devine RIEN", () => {
    expect(entrepotParDefaut([W("a"), W("b")])).toBeNull();
    expect(entrepotParDefaut([])).toBeNull();
  });
});

describe("la visibilité d'une dépense", () => {
  it("un gérant ou un magasinier perdrait de vue une dépense sans dépôt", () => {
    expect(depenseSeraitInvisible("manager", null)).toBe(true);
    expect(depenseSeraitInvisible("stock_keeper", "")).toBe(true);
    expect(depenseSeraitInvisible("manager", "w1")).toBe(false);
  });

  it("le caissier et le propriétaire, non", () => {
    expect(depenseSeraitInvisible("cashier", null)).toBe(false);
    expect(depenseSeraitInvisible("owner", null)).toBe(false);
  });

  it("seul le propriétaire peut ne rattacher aucun dépôt", () => {
    expect(peutNeRattacherAucunDepot("owner")).toBe(true);
    expect(peutNeRattacherAucunDepot("manager")).toBe(false);
  });

  it("un rôle borné SANS affectation n'a aucune issue, et le formulaire le dit", () => {
    expect(saisieSansIssue("manager", [])).toBe(true);
    expect(saisieSansIssue("manager", [W("a")])).toBe(false);
    expect(saisieSansIssue("owner", [])).toBe(false);
  });
});
