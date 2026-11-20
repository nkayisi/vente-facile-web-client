/**
 * Les MÊMES cas que `mobile/vf-marchand/src/data/terme-creation.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { lienCreationArticle, preRemplissageDeCreation } from "./terme-creation";

describe("ce qu'une recherche vide pré-remplit", () => {
  it("un mot devient le NOM", () => {
    expect(preRemplissageDeCreation("  Savon Omo ")).toEqual({ champ: "nom", valeur: "Savon Omo" });
  });

  it("un EAN-13 tapé à la main devient le CODE-BARRES", () => {
    expect(preRemplissageDeCreation("6001087011234")).toEqual({
      champ: "code_barres",
      valeur: "6001087011234",
    });
  });

  it("un EAN-8 aussi", () => {
    expect(preRemplissageDeCreation("96385074")?.champ).toBe("code_barres");
  });

  it("un nombre court reste un nom : une référence, une taille", () => {
    expect(preRemplissageDeCreation("500")?.champ).toBe("nom");
  });

  it("ce qui sort d'un scanner est un code, même alphanumérique", () => {
    expect(preRemplissageDeCreation("ABC-123-X", true)).toEqual({
      champ: "code_barres",
      valeur: "ABC-123-X",
    });
  });

  it("un terme vide ne propose rien", () => {
    expect(preRemplissageDeCreation("   ")).toBeNull();
  });
});

describe("le lien vers la création", () => {
  it("porte le nom et l'origine, encodés", () => {
    expect(lienCreationArticle("Lait & Miel", { origine: "pos" })).toBe(
      "/dashboard/products/new?name=Lait+%26+Miel&origine=pos"
    );
  });

  it("porte le code-barres d'un scan", () => {
    expect(lienCreationArticle("6001087011234")).toBe(
      "/dashboard/products/new?barcode=6001087011234"
    );
  });

  it("rien pour un terme vide", () => {
    expect(lienCreationArticle("")).toBeNull();
  });
});
