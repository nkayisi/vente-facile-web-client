/**
 * La demande à la création, le reçu au paiement, et ce que chacun nomme.
 */
import { describe, expect, it } from "vitest";
import type { CashMovement, Expense } from "@/actions/cashbook.actions";
import { demandeDeDepense, papierDisponible, recuDeDepense } from "./documents-depense";

const chrome = { org: { name: "Boutique Test" } };

const depense = (patch: Partial<Expense> = {}): Expense =>
  ({
    id: "d1",
    reference: "DEP-20261120-0001",
    category: "c1",
    category_name: "Carburant",
    category_color: "#000",
    warehouse: null,
    warehouse_name: null,
    description: "Groupe électrogène",
    amount: "46000.00",
    currency: "CDF",
    exchange_rate: "1",
    status: "draft",
    beneficiary: "Station Total",
    payment_method: null,
    payment_method_name: null,
    payment_reference: "",
    expense_date: "2026-11-20",
    due_date: null,
    paid_date: null,
    is_recurring: false,
    recurrence_period: "",
    notes: "",
    attachment: null,
    created_by: "u-caissier",
    created_by_name: "Caissier One",
    approved_by: null,
    approved_by_name: null,
    created_at: "2026-11-20T08:00:00Z",
    ...patch,
  }) as Expense;

const sortie = (patch: Partial<CashMovement> = {}): CashMovement =>
  ({
    id: "m1",
    movement_date: "2026-11-21T13:30:00Z",
    created_by_name: "Gérant Test",
    register_name: "Caisse Principale",
    is_cancelled: false,
    ...patch,
  }) as CashMovement;

describe("papierDisponible", () => {
  it("le reçu une fois payée, la demande avant, rien après un rejet", () => {
    expect(papierDisponible("paid")).toBe("recu");
    expect(papierDisponible("draft")).toBe("demande");
    expect(papierDisponible("pending")).toBe("demande");
    expect(papierDisponible("approved")).toBe("demande");
    expect(papierDisponible("rejected")).toBeNull();
    expect(papierDisponible("cancelled")).toBeNull();
  });
});

describe("demandeDeDepense", () => {
  it("nomme le demandeur et la date de la dépense, sans la lire en UTC", () => {
    const d = demandeDeDepense(depense(), chrome);
    expect(d.kind).toBe("expense_request");
    expect(d.cashierName).toBe("Caissier One");
    expect(d.date).toBe("20/11/2026");
    expect(d.number).toBe("DEP-20261120-0001");
  });
});

describe("recuDeDepense", () => {
  it("nomme le PAYEUR et sa caisse, pas l'auteur de la dépense", () => {
    const r = recuDeDepense(
      depense({
        status: "paid",
        approved_by_name: "Propriétaire",
        payment_method_name: "Espèces",
        cash_movements: [sortie({ is_cancelled: true, created_by_name: "Annulé" }), sortie()],
      }),
      chrome,
      { duplicata: true }
    );
    expect(r.kind).toBe("expense");
    expect(r.cashierName).toBe("Gérant Test");
    expect(r.registerName).toBe("Caisse Principale");
    expect(r.approvedBy).toBe("Propriétaire");
    expect(r.isDuplicate).toBe(true);
  });

  it("retombe sur le jour du paiement quand la sortie manque", () => {
    const r = recuDeDepense(depense({ status: "paid", paid_date: "2026-11-21" }), chrome);
    expect(r.date).toBe("21/11/2026");
    expect(r.cashierName).toBeUndefined();
  });
});
