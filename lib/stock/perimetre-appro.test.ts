/**
 * Le périmètre d'une feuille d'approvisionnement, aller-retour par l'URL.
 *
 * Une erreur d'encodage y préparerait la feuille du MAUVAIS périmètre sans que
 * rien ne le signale : seul l'écran le dirait, et seulement à qui regarde.
 */
import { describe, expect, it } from "vitest";

import {
  avecLesNoms,
  depuisParams,
  motifIncomplet,
  PERIMETRE_VIDE,
  resumePerimetre,
  versParams,
  type PerimetreAppro,
} from "./perimetre-appro";

const P = (p: Partial<PerimetreAppro>): PerimetreAppro => ({ ...PERIMETRE_VIDE, ...p });

describe("l'aller-retour par l'URL", () => {
  it("rend exactement le périmètre parti, aux libellés près", () => {
    const parti = P({
      entrepot: "w1",
      type: "initial",
      portee: "category",
      categories: [{ value: "c1", label: "Boissons" }, { value: "c2", label: "Sodas, jus" }],
      recherche: "  coca ",
    });
    const { perimetre, aucunParametre } = depuisParams(versParams(parti));
    expect(aucunParametre).toBe(false);
    expect(perimetre.entrepot).toBe("w1");
    expect(perimetre.type).toBe("initial");
    expect(perimetre.portee).toBe("category");
    // ⚠ Seuls les IDENTIFIANTS voyagent : un nom porte des virgules.
    expect(perimetre.categories.map((c) => c.value)).toEqual(["c1", "c2"]);
    expect(perimetre.recherche).toBe("coca");
  });

  it("n'envoie pas les catégories d'une portée qui n'en a pas", () => {
    const params = versParams(P({ entrepot: "w1", portee: "low", categories: [{ value: "c1", label: "x" }] }));
    expect(params.has("categories")).toBe(false);
  });

  it("une valeur inconnue retombe sur le défaut, sans lever", () => {
    const { perimetre } = depuisParams(new URLSearchParams("warehouse=w1&type=vol&scope=tout"));
    expect(perimetre.type).toBe(PERIMETRE_VIDE.type);
    expect(perimetre.portee).toBe(PERIMETRE_VIDE.portee);
  });

  it("sans entrepôt, il n'y a rien à préparer", () => {
    expect(depuisParams(new URLSearchParams("scope=all")).aucunParametre).toBe(true);
  });

  it("une liste d'identifiants sans trou ni doublon", () => {
    const { perimetre } = depuisParams(
      new URLSearchParams("warehouse=w1&scope=product&products=a,,b, a ,b")
    );
    expect(perimetre.articles.map((a) => a.value)).toEqual(["a", "b"]);
  });
});

describe("les noms du serveur", () => {
  it("nomment les puces, et une entrée inconnue garde ce qu'elle avait", () => {
    const p = P({ categories: [{ value: "c1", label: "c1" }, { value: "c9", label: "c9" }] });
    const r = avecLesNoms(p, { categories: [{ value: "c1", label: "Boissons" }] });
    expect(r.categories).toEqual([
      { value: "c1", label: "Boissons" },
      { value: "c9", label: "c9" },
    ]);
  });
});

describe("motifIncomplet", () => {
  it("exige l'entrepôt, puis une catégorie ou un article selon la portée", () => {
    expect(motifIncomplet(P({}))).toMatch(/entrepôt/);
    expect(motifIncomplet(P({ entrepot: "w1", portee: "category" }))).toMatch(/catégorie/);
    expect(motifIncomplet(P({ entrepot: "w1", portee: "product" }))).toMatch(/article/);
    expect(motifIncomplet(P({ entrepot: "w1", portee: "all" }))).toBeNull();
  });
});

describe("resumePerimetre", () => {
  it("accorde le nombre d'articles, sans « (s) »", () => {
    const un = resumePerimetre(P({ portee: "product", articles: [{ value: "a", label: "A" }] }), "Dépôt");
    const deux = resumePerimetre(
      P({ portee: "product", articles: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }),
      "Dépôt"
    );
    expect(un).toContain("1 article");
    expect(un).not.toContain("articles");
    expect(deux).toContain("2 articles");
    expect(`${un}${deux}`).not.toContain("(s)");
  });
});
