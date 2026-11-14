import { describe, expect, it } from "vitest";

import { compte, depuis, raisonSansPriseEnMain, raisonSansReinitialisation, tonEcheance } from "./format";

describe("compte", () => {
  it("accorde, zéro et un au singulier", () => {
    expect(compte(0, "établissement", "établissements")).toBe("0 établissement");
    expect(compte(1, "établissement", "établissements")).toBe("1 établissement");
    expect(compte(3, "établissement", "établissements")).toMatch(/^3 établissements$/);
  });

  it("un compte inconnu vaut zéro, au singulier", () => {
    expect(compte(null, "compte", "comptes")).toBe("0 compte");
  });
});

describe("tonEcheance", () => {
  it("l'échu est rouge, testé AVANT l'avertissement", () => {
    // ⚠ Tester « ≤ 5 » d'abord rangeait un abonnement échu en ambre.
    expect(tonEcheance(0)).toBe("text-destructive");
    expect(tonEcheance(-3)).toBe("text-destructive");
    expect(tonEcheance(5)).toBe("text-warning");
    expect(tonEcheance(6)).toBe("");
  });
});

describe("depuis", () => {
  it("passe des minutes aux heures puis aux jours", () => {
    expect(depuis(42)).toBe("42 min");
    expect(depuis(125)).toBe("2 h");
    expect(depuis(60 * 72)).toBe("3 j");
  });
});

describe("raisonSansPriseEnMain", () => {
  it("un compte fermé, puis un administrateur, n'ouvrent aucune prise en main", () => {
    expect(raisonSansPriseEnMain(false, false)).toBe("Compte inactif");
    expect(raisonSansPriseEnMain(true, true)).toMatch(/Administrateur/);
    expect(raisonSansPriseEnMain(true, false)).toBeNull();
  });
});

describe("raisonSansReinitialisation", () => {
  const base = { soiMeme: false, compteActif: true, administrateur: false, peutGererAdministrateurs: false };

  it("ouvre le geste sur un marchand actif", () => {
    expect(raisonSansReinitialisation(base)).toBeNull();
  });

  it("ferme son propre compte, qui se change depuis le profil", () => {
    expect(raisonSansReinitialisation({ ...base, soiMeme: true })).toMatch(/profil/);
  });

  it("ferme un compte désactivé", () => {
    expect(raisonSansReinitialisation({ ...base, compteActif: false })).toMatch(/réactivez/);
  });

  it("ferme un administrateur au support, l'ouvre au super-administrateur", () => {
    expect(raisonSansReinitialisation({ ...base, administrateur: true })).toMatch(/super-administrateur/);
    expect(
      raisonSansReinitialisation({ ...base, administrateur: true, peutGererAdministrateurs: true }),
    ).toBeNull();
  });
});
