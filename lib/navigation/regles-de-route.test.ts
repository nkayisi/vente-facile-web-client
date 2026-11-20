import { describe, expect, it } from "vitest";

import { pageOuverte, regleDeRoute } from "./regles-de-route";

/** Les permissions d'un rôle, en fonction `hasPermission`. */
const role = (...codes: string[]) => (p: string) => codes.includes(p);

// Les codes que le serveur accorde à ces rôles (apps/core/services.py).
const CAISSIER = role(
  "organization.view", "sales.view", "sales.create", "payment_methods.view",
  "products.view", "customers.view", "customers.create", "cashbook.view",
  "cashbook.create_expense", "cashbook.pay_expense", "cashbook.create_movement",
  "cashbook.view_reports", "dashboard.view",
);
const GERANT_SANS_ABONNEMENT = role("dashboard.view", "settings.view", "sales.view");

describe("regleDeRoute", () => {
  it("prend la règle la plus précise, pas le premier préfixe venu", () => {
    expect(regleDeRoute("/dashboard/sales/returns/abc")?.permission).toBe("sale_returns.view");
    expect(regleDeRoute("/dashboard/sales/history")?.permission).toBe("sales.view");
    expect(regleDeRoute("/dashboard/contacts/suppliers/abc")?.permission).toBe("suppliers.view");
    expect(regleDeRoute("/dashboard/notifications")?.permission).toBe("dashboard.view");
  });

  it("garde l'abonnement par subscription.view, pas par settings.view", () => {
    expect(regleDeRoute("/dashboard/subscription")?.permission).toBe("subscription.view");
  });
});

describe("pageOuverte", () => {
  it("ferme au caissier les retours et les fournisseurs, que le serveur lui refuse", () => {
    expect(pageOuverte("/dashboard/sales", CAISSIER)).toBe(true);
    expect(pageOuverte("/dashboard/sales/returns", CAISSIER)).toBe(false);
    expect(pageOuverte("/dashboard/contacts", CAISSIER)).toBe(true);
    expect(pageOuverte("/dashboard/contacts/customers", CAISSIER)).toBe(true);
    expect(pageOuverte("/dashboard/contacts/suppliers", CAISSIER)).toBe(false);
  });

  it("ne montre pas « Abonnement » au gérant qui voit les paramètres", () => {
    expect(pageOuverte("/dashboard/settings", GERANT_SANS_ABONNEMENT)).toBe(true);
    expect(pageOuverte("/dashboard/subscription", GERANT_SANS_ABONNEMENT)).toBe(false);
  });

  it("ouvre une page sans règle", () => {
    expect(pageOuverte("/payment/checkout", role())).toBe(true);
  });
});
