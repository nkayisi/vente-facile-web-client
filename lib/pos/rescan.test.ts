import { describe, expect, it } from "vitest";
import { estLeMemeArticle, frapperDansLaSaisie, rescanAuRepos, type EtatRescan } from "./rescan";

/** Tape `texte` à partir de `debut`, `pas` millisecondes entre deux touches. */
function taper(
  etat: EtatRescan<string>,
  texte: string,
  debut: number,
  pas: number,
  champ: { valeur: string }
) {
  let e = etat;
  let t = debut;
  for (const touche of texte) {
    const r = frapperDansLaSaisie(e, touche, t, champ.valeur);
    e = r.etat;
    champ.valeur += touche;
    t += pas;
  }
  return { etat: e, fin: t };
}

describe("frapperDansLaSaisie", () => {
  it("reconnaît un scan et rend la saisie d'avant la rafale", () => {
    const champ = { valeur: "1" };
    const { etat, fin } = taper(rescanAuRepos(), "600123456789", 1000, 8, champ);
    const r = frapperDansLaSaisie(etat, "Enter", fin, champ.valeur);
    expect(r.scan).toEqual({ candidats: ["600123456789"], avant: "1" });
  });

  it("ne prend jamais une frappe humaine pour un scan", () => {
    const champ = { valeur: "" };
    const { etat, fin } = taper(rescanAuRepos(), "12", 1000, 250, champ);
    expect(frapperDansLaSaisie(etat, "Enter", fin + 200, champ.valeur).scan).toBeNull();
  });

  it("garde son point de reprise quand le premier caractère arrive en retard", () => {
    const champ = { valeur: "1" };
    let e = frapperDansLaSaisie(rescanAuRepos<string>(), "8", 1000, champ.valeur).etat;
    champ.valeur += "8";
    // Le deuxième caractère arrive 60 ms plus tard : la rafale repart de lui.
    const suite = taper(e, "7687GJHGD", 1060, 8, champ);
    e = suite.etat;
    const r = frapperDansLaSaisie(e, "Enter", suite.fin, champ.valeur);
    expect(r.scan?.avant).toBe("1");
    expect(r.scan?.candidats).toEqual(["7687GJHGD", "87687GJHGD"]);
  });
});

describe("estLeMemeArticle", () => {
  it("compare au code-barres et au SKU, sans la casse", () => {
    expect(estLeMemeArticle(["600123456789"], { barcode: "600123456789", sku: "X" })).toBe(true);
    expect(estLeMemeArticle(["art-1"], { barcode: "", sku: "ART-1" })).toBe(true);
    expect(estLeMemeArticle(["7687GJHGD", "87687GJHGD"], { barcode: "87687GJHGD" })).toBe(true);
    expect(estLeMemeArticle(["999"], { barcode: "600", sku: "ART" })).toBe(false);
  });
});
