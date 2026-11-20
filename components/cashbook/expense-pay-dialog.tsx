"use client";

/**
 * Payer une dépense : c'est ICI que l'argent sort.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ EN ESPÈCES, LES BILLETS SORTENT DE LA CAISSE DE CELUI QUI PAIE.          │
 * │                                                                          │
 * │ La sortie était faite à l'approbation, rattachée à l'approbateur, et le  │
 * │ Z du caissier qui remettait les billets annonçait un excédent. Elle se   │
 * │ fait désormais au paiement, dans la caisse ouverte du payeur : le        │
 * │ serveur refuse un paiement en espèces sans caisse ouverte, et la boîte   │
 * │ le DIT avant l'envoi plutôt que de laisser découvrir le refus.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE REÇU DE DÉPENSE SORT ICI, ET PLUS À LA CRÉATION.                      │
 * │                                                                          │
 * │ C'est la pièce justificative d'une sortie d'argent : elle ne pouvait pas │
 * │ précéder la sortie. Il nomme le PAYEUR, l'instant du paiement et la      │
 * │ caisse, lus dans la réponse du serveur (la fiche détaillée).             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Montée à l'ouverture seulement : chaque ouverture est un formulaire vierge.
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { payExpense, type Expense } from "@/actions/cashbook.actions";
import { recuDeDepense } from "@/lib/cashbook/documents-depense";
import { buildExpenseReceipt, type PaperWidth, type ReceiptChrome } from "@/lib/receipt";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";
import { getPaymentMethods, type PaymentMethod } from "@/actions/sales.actions";
import { useOrganization } from "@/components/auth/organization-checker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Ce qui n'est pas de l'argent remis : on ne paie pas une dépense « à crédit ». */
const HORS_PAIEMENT = new Set(["credit", "loyalty", "advance"]);

export function ExpensePayDialog({
  expense,
  direct,
  montant,
  chrome,
  paperWidth,
  onClose,
  onPaid,
}: {
  expense: Expense;
  /** Payer un brouillon ou une dépense en attente : vaut une approbation. */
  direct: boolean;
  /** Le montant déjà formaté avec sa devise. */
  montant: string;
  /** L'identité imprimée ; `null` tant qu'elle se charge : rien ne s'imprime. */
  chrome: ReceiptChrome | null;
  paperWidth: PaperWidth;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const printer = useReceiptPrinter();
  const jeton = session?.accessToken;
  const orgId = organization?.id;

  const [moyens, setMoyens] = useState<PaymentMethod[] | null>(null);
  const [moyen, setMoyen] = useState<string>("");
  const [reference, setReference] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  useEffect(() => {
    if (!jeton || !orgId) return;
    let annule = false;
    getPaymentMethods(jeton, orgId, { is_active: true, page_size: 100 }).then((r) => {
      if (annule) return;
      const liste = (r.success && r.data ? r.data : []).filter(
        (m) => !HORS_PAIEMENT.has(m.method_type)
      );
      setMoyens(liste);
      // Le moyen déjà noté sur la dépense, sinon les espèces : c'est le cas
      // ordinaire d'une petite dépense réglée au comptoir.
      const choix =
        liste.find((m) => m.id === expense.payment_method) ??
        liste.find((m) => m.method_type === "cash") ??
        liste[0];
      setMoyen(choix?.id ?? "");
    });
    return () => {
      annule = true;
    };
  }, [jeton, orgId, expense.payment_method]);

  const choisi = useMemo(() => moyens?.find((m) => m.id === moyen) ?? null, [moyens, moyen]);
  const enEspeces = !choisi || choisi.method_type === "cash";

  async function payer() {
    if (!jeton || !orgId) return;
    setEnvoi(true);
    setRefus(null);
    // Ouvert sur le geste, avant l'appel réseau : sinon le navigateur bloque
    // la fenêtre du reçu.
    const job = chrome ? printer.begin() : null;
    try {
      const r = await payExpense(jeton, orgId, expense.id, {
        payment_method: moyen || undefined,
        payment_reference: reference.trim() || undefined,
      });
      if (r.success) {
        if (job && chrome && r.data) {
          job.present(buildExpenseReceipt(recuDeDepense(r.data, chrome)), {
            filename: `depense-${r.data.reference}.pdf`,
            paperWidth,
            successMessage: "Dépense payée",
          });
        } else {
          job?.abort();
          toast.success("Dépense payée");
        }
        onPaid();
        onClose();
      } else {
        job?.abort();
        // Le refus reste DANS la boîte : « ouvrez votre caisse » se lit là où
        // l'on peut changer de moyen de paiement.
        setRefus(r.error || "Le paiement n'a pas pu être enregistré.");
      }
    } catch {
      job?.abort();
      setRefus("Le paiement n'a pas pu être enregistré.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{direct ? "Approuver et payer" : "Payer la dépense"}</DialogTitle>
          <DialogDescription>
            {expense.reference} · {expense.description} · <strong>{montant}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="moyen-paiement-depense">Moyen de paiement</Label>
            <Select value={moyen} onValueChange={setMoyen} disabled={!moyens}>
              <SelectTrigger id="moyen-paiement-depense" className="w-full">
                <SelectValue placeholder={moyens ? "Choisir" : "Chargement…"} />
              </SelectTrigger>
              <SelectContent>
                {(moyens ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {enEspeces
                ? "En espèces, l'argent sort de VOTRE caisse : elle doit être ouverte, et la sortie figurera dans votre clôture."
                : "Hors espèces, aucune caisse n'est touchée."}
            </p>
          </div>

          {!enEspeces && (
            <div className="space-y-2">
              <Label htmlFor="reference-paiement-depense">Référence (facultatif)</Label>
              <Input
                id="reference-paiement-depense"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="N° de transaction"
              />
            </div>
          )}

          {direct && (
            <p className="text-xs text-muted-foreground">
              Cette dépense n&apos;est pas encore approuvée : la payer l&apos;approuve du même geste.
            </p>
          )}

          {refus && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {refus}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={envoi}>
            Fermer
          </Button>
          <Button onClick={payer} disabled={envoi || !moyens}>
            {envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {direct ? "Approuver et payer" : "Payer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
