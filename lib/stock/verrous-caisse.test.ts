import { describe, expect, it } from "vitest";

import { verrousDeLaCaisse } from "./verrous-caisse";

const session = (reference: string, warehouse__name: string) => ({ reference, warehouse__name });

describe("les verrous qui pèsent sur la caisse", () => {
  it("rien de verrouillé : la carte est vide", () => {
    expect(verrousDeLaCaisse({ locked_product_ids: [], active_sessions: [] }, "Boutique").size).toBe(0);
    expect(verrousDeLaCaisse(null, "Boutique").size).toBe(0);
  });

  it("un inventaire dans l'entrepôt de la caisse ferme ses articles, en nommant la session", () => {
    const verrous = verrousDeLaCaisse(
      { locked_product_ids: ["p1", "p2"], active_sessions: [session("INV-1", "Boutique")] },
      "Boutique"
    );
    expect([...verrous.entries()]).toEqual([
      ["p1", "INV-1"],
      ["p2", "INV-1"],
    ]);
  });

  it("un inventaire d'un AUTRE entrepôt ne ferme pas ce comptoir", () => {
    // Le serveur ne refuse la vente que dans l'entrepôt de la vente : fermer
    // « Encaisser » ici serait un refus qu'il n'oppose pas.
    const verrous = verrousDeLaCaisse(
      { locked_product_ids: ["p1"], active_sessions: [session("INV-9", "Réserve")] },
      "Boutique"
    );
    expect(verrous.size).toBe(0);
  });

  it("sessions de plusieurs dépôts : on garde tout, sans inventer de référence", () => {
    // La réponse ne dit pas quel article relève de laquelle : le côté strict.
    const verrous = verrousDeLaCaisse(
      {
        locked_product_ids: ["p1"],
        active_sessions: [session("INV-1", "Boutique"), session("INV-2", "Boutique"), session("INV-9", "Réserve")],
      },
      "Boutique"
    );
    expect(verrous.get("p1")).toBe("");
  });

  it("entrepôt de la caisse inconnu : une seule session se nomme, plusieurs non", () => {
    expect(
      verrousDeLaCaisse({ locked_product_ids: ["p1"], active_sessions: [session("INV-1", "X")] }, null).get("p1")
    ).toBe("INV-1");
    expect(
      verrousDeLaCaisse(
        { locked_product_ids: ["p1"], active_sessions: [session("INV-1", "X"), session("INV-2", "Y")] },
        null
      ).get("p1")
    ).toBe("");
  });
});
