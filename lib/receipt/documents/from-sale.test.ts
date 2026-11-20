/**
 * Le duplicata d'une vente : la monnaie rendue garde la devise des billets
 * RENDUS. Relevé le 2026-11-14 sur `VT-20261114-B3U7-0002`, facture en dollars,
 * 89 240 rendus en francs : le ticket écrivait « 89 240.00 $ ».
 */
import { describe, expect, it } from "vitest";

import type { Sale } from "@/actions/sales.actions";
import { buildSaleReceipt } from "./sale";
import { echeanceImprimee, saleReceiptFromSale } from "./from-sale";

const vente = {
  reference: "VT-20261114-B3U7-0002",
  sale_date: "2026-11-14T10:00:00Z",
  sale_type: "retail",
  currency: "USD",
  items: [],
  subtotal: "561.20",
  tax_amount: "0.00",
  discount_amount: "0.00",
  loyalty_redemption_amount: "0.00",
  total: "561.20",
  amount_paid: "600.00",
  amount_due: "0.00",
  change_amount: "89240.00",
  change_currency: "CDF",
  payments: [],
} as unknown as Sale;

const options = { chrome: { org: { name: "Boutique" } } };

function ligneMonnaie(sale: Sale): string | undefined {
  return buildSaleReceipt(saleReceiptFromSale(sale, options))
    .flatMap((b) => (b.kind === "amounts" ? b.rows : []))
    .find((r) => r.label === "Monnaie rendue")?.value;
}

describe("saleReceiptFromSale : la monnaie rendue", () => {
  it("s'imprime dans la devise des billets rendus", () => {
    const v = ligneMonnaie(vente);
    expect(v).toContain("FC");
    expect(v).not.toContain("$");
  });

  it("retombe sur la devise de la facture quand le serveur n'en dit rien", () => {
    expect(ligneMonnaie({ ...vente, change_amount: "5.00", change_currency: "" })).toContain("$");
  });
});

describe("echeanceImprimee", () => {
  it("lit la date par découpage, sans fuseau", () => {
    expect(echeanceImprimee("2026-12-05")).toBe("05/12/2026");
    expect(echeanceImprimee("2026-12-05T00:00:00Z")).toBe("05/12/2026");
  });
  it("rend undefined sans échéance, pour que la ligne disparaisse", () => {
    expect(echeanceImprimee(null)).toBeUndefined();
    expect(echeanceImprimee("")).toBeUndefined();
  });
});
