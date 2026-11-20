import { describe, expect, it } from "vitest";
import {
  ajouterAuBordereau,
  fusionnerProposition,
  lignesRetenues,
  nombreDeRefus,
  quantiteEnvoyee,
  refusDeLigne,
  retirerDuBordereau,
  type LigneBordereau,
} from "./bordereau-requisition";

const proposition = (product: string, suggested = 10) => ({
  product,
  product_name: product,
  product_sku: null,
  unit_name: null,
  stock: 2,
  reorder_point: 12,
  suggested,
});

describe("le bordereau d'une réquisition", () => {
  it("la proposition arrive cochée, à sa suggestion", () => {
    const [l] = fusionnerProposition([proposition("savon", 8)]);
    expect(l).toMatchObject({ retenue: true, quantite: "8", ajoutee: false });
  });

  it("recharger la proposition GARDE les quantités corrigées", () => {
    const avant = fusionnerProposition([proposition("savon", 8)]).map((l) => ({
      ...l,
      quantite: "20",
    }));
    const apres = fusionnerProposition([proposition("savon", 8)], avant);
    expect(apres[0].quantite).toBe("20");
  });

  it("recharger la proposition GARDE les articles ajoutés à la main", () => {
    const { lignes } = ajouterAuBordereau(fusionnerProposition([proposition("savon")]), {
      product: "lait",
      product_name: "Lait",
      product_sku: null,
      unit_name: null,
      stock: 30,
      reorder_point: 5,
    });
    // « Ruptures seulement » : le savon n'est plus proposé.
    const apres = fusionnerProposition([], lignes);
    expect(apres.map((l) => l.product)).toEqual(["lait"]);
  });

  it("un article déjà au bordereau n'y entre pas deux fois", () => {
    const lignes = fusionnerProposition([proposition("savon")]);
    const r = ajouterAuBordereau(lignes, { ...proposition("savon") });
    expect(r.deja).toBe(true);
    expect(r.lignes).toHaveLength(1);
  });

  it("un article ajouté attend sa quantité : il ne part pas vide", () => {
    const { lignes } = ajouterAuBordereau([], {
      product: "lait", product_name: "Lait", product_sku: null, unit_name: null,
      stock: 0, reorder_point: 0,
    });
    expect(lignesRetenues(lignes)).toEqual([]);
  });

  it("« 12 500 » et « 2,5 » se lisent, une saisie illisible ne part pas", () => {
    const base = fusionnerProposition([proposition("a"), proposition("b"), proposition("c")]);
    const saisies: LigneBordereau[] = [
      { ...base[0], quantite: "12 500" },
      { ...base[1], quantite: "2,5" },
      { ...base[2], quantite: "12,5,0" },
    ];
    const retenues = lignesRetenues(saisies);
    expect(retenues.map(quantiteEnvoyee)).toEqual(["12500", "2.5"]);
  });

  it("une saisie illisible COCHÉE se nomme et retient l'envoi", () => {
    const [l] = fusionnerProposition([proposition("a")]);
    expect(refusDeLigne({ ...l, quantite: "12,5,0" })).toBe("illisible");
    expect(refusDeLigne({ ...l, quantite: "-3" })).toBe("negatif");
    // Décochée ou vide : pas une faute.
    expect(refusDeLigne({ ...l, quantite: "12,5,0", retenue: false })).toBeNull();
    expect(refusDeLigne({ ...l, quantite: "" })).toBeNull();
    expect(nombreDeRefus([{ ...l, quantite: "abc" }, l])).toBe(1);
  });

  it("seule une ligne AJOUTÉE se retire ; une ligne proposée reste", () => {
    const base = fusionnerProposition([proposition("savon")]);
    const { lignes } = ajouterAuBordereau(base, {
      product: "lait", product_name: "Lait", product_sku: null, unit_name: null,
      stock: 0, reorder_point: 0,
    });
    expect(retirerDuBordereau(lignes, "lait").map((l) => l.product)).toEqual(["savon"]);
    expect(retirerDuBordereau(lignes, "savon").map((l) => l.product)).toEqual(["savon", "lait"]);
  });
});
