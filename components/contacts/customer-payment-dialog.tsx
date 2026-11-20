"use client";

/**
 * Encaisser de l'argent d'un client, depuis sa fiche.
 *
 * « Avance » et « règlement » sont LE MÊME ACTE (`record-advance` n'est qu'un
 * alias de `record-payment` côté serveur) : un seul bouton, et la boîte ANNONCE
 * l'imputation avant de la faire. Les factures ouvertes sont soldées de la plus
 * ancienne à la plus récente ; seul le reliquat devient une avance. Le marchand
 * ne doit pas le découvrir sur le reçu du client.
 *
 * Deux devises, à ne pas confondre : celle des BILLETS remis (elle entre au
 * tiroir) et celle des FACTURES visées. Un client qui doit en dollars peut payer
 * en francs : sans ce choix, l'argent partait en avance en francs pendant que la
 * dette en dollars restait entière.
 *
 * ⚠ LE GENRE DU REÇU SUIT CE QUE LE SERVEUR A FAIT, pas l'aperçu : il est lu des
 *   factures réellement soldées (`settled_invoices`), et le numéro (`RGL-` ou
 *   `AVC-`) vient du serveur.
 */
import { chromeDeSecours } from "@/lib/receipt/chrome";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { HandCoins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { recordCustomerPayment, type Customer } from "@/actions/contacts.actions";
import type { PaymentMethod, Sale } from "@/actions/sales.actions";
import { useOrganization } from "@/components/auth/organization-checker";
import { usePermissions } from "@/components/auth/permissions-provider";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";
import { detteNonVisible, imputer, type FactureAImputer } from "@/lib/contacts/imputation";
import type { MoneyHelpers } from "@/lib/currency";
import { buildPaymentReceipt, type PaperWidth, type ReceiptChrome } from "@/lib/receipt";
import { lireNombre, phraseDeRefus } from "@/lib/stock/nombres";

/**
 * L'ordre d'imputation du serveur : `created_at` (`open_credit_sales`).
 *
 * ⚠ Le repli sur `sale_date` n'est pas décoratif : la liste des ventes n'a
 *   exposé `created_at` qu'au lot L11, et le type le déclarait quand même - un
 *   `localeCompare` sur `undefined` faisait planter TOUTE la fiche client.
 */
function ordreServeur(a: Sale, b: Sale): number {
  return (a.created_at || a.sale_date || "").localeCompare(b.created_at || b.sale_date || "");
}

/** Ce qui n'est pas de l'argent remis : on n'encaisse pas un client « à crédit ». */
const HORS_ENCAISSEMENT = new Set(["credit", "loyalty", "advance"]);

export function CustomerPaymentDialog({
  open,
  onOpenChange,
  customer,
  factures,
  paymentMethods,
  money,
  chrome,
  paperWidth,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  /** Factures ouvertes du client, telles que la fiche les a chargées. */
  factures: Sale[];
  paymentMethods: PaymentMethod[];
  money: MoneyHelpers;
  chrome: ReceiptChrome | null;
  paperWidth: PaperWidth;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const printer = useReceiptPrinter();
  // Qui voit TOUTES les ventes voit toutes les factures : l'écart entre la
  // dette et les factures ne peut alors venir que d'une dette SANS facture
  // (un ajustement). Pour les autres, c'est d'abord la facture d'un collègue.
  //
  // ⚠ Le PROPRIÉTAIRE, et non `sales.view_all` : un gérant qui a ce droit ne
  //   voit que les ventes de SES dépôts (`SaleViewSet` borne par entrepôt), et
  //   prendrait les factures d'une autre boutique pour une dette hors facture.
  //   Même critère que le terminal (`lireReliquat`).
  const { isRole } = usePermissions();
  const voitToutesLesVentes = isRole("owner");

  const moyens = useMemo(
    () => paymentMethods.filter((m) => m.is_active && !HORS_ENCAISSEMENT.has(m.method_type)),
    [paymentMethods]
  );

  // La devise des factures visées part de celle de la plus ancienne facture
  // ouverte : c'est elle que le serveur soldera d'abord.
  const plusAncienne = useMemo(() => [...factures].sort(ordreServeur)[0], [factures]);
  const deviseInitiale = plusAncienne?.currency || money.primaryCode;

  const [saisie, setSaisie] = useState("");
  const [devise, setDevise] = useState(deviseInitiale);
  const [deviseImputation, setDeviseImputation] = useState(deviseInitiale);
  const [methodeId, setMethodeId] = useState(
    () => (moyens.find((m) => m.is_default) ?? moyens[0])?.id ?? ""
  );
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const methode = moyens.find((m) => m.id === methodeId);
  const lu = lireNombre(saisie);
  const saisi = lu.ok && lu.valeur !== null ? lu.valeur : 0;

  // Factures de la devise visée, dans l'ORDRE du serveur (`created_at`).
  const ouvertes: FactureAImputer[] = useMemo(
    () =>
      factures
        .filter((f) => f.currency === deviseImputation)
        .sort(ordreServeur)
        .map((f) => ({ reference: f.reference, resteAPayer: parseFloat(f.amount_due) || 0 })),
    [factures, deviseImputation]
  );
  const dette = Math.max(
    0,
    parseFloat(customer.balances?.find((b) => b.currency === deviseImputation)?.amount ?? "0") || 0
  );
  const nonVisible = detteNonVisible(dette, ouvertes);
  // ⚠ « Des factures » compte AUSSI celles qu'on ne voit pas : sans elles, un
  //   caissier qui n'en voit aucune annoncerait une avance pour un versement que
  //   le serveur imputera à la facture d'un collègue.
  const aDesFactures = ouvertes.length > 0 || nonVisible > 0;

  const enDeviseImputation = saisi > 0 ? money.convMoney(saisi, devise, deviseImputation) : 0;
  const { soldees, partielle, avance: reliquat } = imputer(enDeviseImputation, ouvertes);
  // ⚠ LE RELIQUAT N'EST PAS TOUJOURS UNE AVANCE : il éponge d'abord une dette
  //   sans facture (`settle_debt` réduit le solde avant de le rendre créditeur).
  //   Annoncer « avance » sur ce montant promettrait au client un crédit qu'il
  //   n'aura pas. Seul celui qui voit toutes les ventes peut le chiffrer.
  const horsFacture = voitToutesLesVentes ? Math.min(reliquat, nonVisible) : 0;
  const avance = reliquat - horsFacture;

  const motifMontant = !lu.ok ? phraseDeRefus(lu.motif) : null;
  const referenceManquante = !!methode?.requires_reference && !reference.trim();
  const bloque = envoi || saisi <= 0 || !methode || referenceManquante || !!motifMontant;

  const valider = async () => {
    const jeton = session?.accessToken;
    if (bloque || !jeton || !organization || !methode) return;
    // L'onglet d'impression s'ouvre DANS le geste : après l'appel réseau, le
    // navigateur le bloquerait comme une fenêtre surgissante.
    const job = printer.begin();
    setEnvoi(true);
    try {
      const montant = Math.round(saisi * 100) / 100;
      const r = await recordCustomerPayment(jeton, organization.id, customer.id, {
        amount: montant,
        currency: devise,
        settle_currency: deviseImputation,
        payment_method: methode.method_type,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (!r.success || !r.data) {
        job.abort();
        toast.error(r.message || "L'encaissement n'a pas pu être enregistré");
        return;
      }
      const d = r.data;
      const reglees = d.settled_invoices ?? [];
      const kind = reglees.length > 0 ? "debt_payment" : "advance";
      job.present(
        buildPaymentReceipt({
          kind,
          chrome: chrome ?? chromeDeSecours(organization.name),
          number: d.receipt_number,
          date: new Date().toLocaleString("fr-CD"),
          customerName: customer.name,
          customerPhone: customer.phone || undefined,
          paymentMethod: methode.name,
          paymentReference: reference.trim() || undefined,
          amountPaid: montant,
          currency: devise,
          settledInvoices: reglees,
          // Les soldes de l'enveloppe sont dans la devise REMISE.
          debt: {
            before: parseFloat(d.balance_before) || 0,
            after: parseFloat(d.balance_after) || 0,
            currency: d.currency || devise,
          },
          notes: notes.trim() || undefined,
        }),
        {
          filename: `${kind === "advance" ? "avance" : "reglement"}-${d.receipt_number}.pdf`,
          paperWidth,
          successMessage:
            reglees.length > 0
              ? `Reçu ${d.receipt_number} : ${reglees.length > 1 ? `${reglees.length} factures` : "1 facture"} imputée${reglees.length > 1 ? "s" : ""}`
              : `Reçu ${d.receipt_number} : avance enregistrée`,
        }
      );
      onOpenChange(false);
      onDone();
    } catch {
      job.abort();
      toast.error("L'encaissement n'a pas pu être enregistré");
    } finally {
      setEnvoi(false);
    }
  };

  // Les devises actives de l'établissement, la principale en tête.
  const currencies = [
    money.primaryCode,
    ...money.currencies.filter((c) => c.is_active && c.currency_code !== money.primaryCode).map((c) => c.currency_code),
  ];
  const plusieursDevises = currencies.length > 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !envoi && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-orange-500" />
            Encaisser de {customer.name}
          </DialogTitle>
          <DialogDescription>
            Les factures ouvertes sont soldées de la plus ancienne à la plus récente ; ce qui reste devient une
            avance sur ses prochains achats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="enc-montant">Montant reçu</Label>
              <Input
                id="enc-montant"
                inputMode="decimal"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                aria-invalid={!!motifMontant}
              />
              {motifMontant && <p className="text-xs text-destructive">{motifMontant}</p>}
            </div>
            {plusieursDevises && (
              <div className="space-y-1.5">
                <Label htmlFor="enc-devise">Devise remise</Label>
                <Select value={devise} onValueChange={setDevise}>
                  <SelectTrigger id="enc-devise" className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {plusieursDevises && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-imputation">Factures visées</Label>
              <Select value={deviseImputation} onValueChange={setDeviseImputation}>
                <SelectTrigger id="enc-imputation" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>Factures en {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {devise !== deviseImputation && saisi > 0 && (
                <p className="text-xs text-muted-foreground">
                  {money.money(saisi, devise)} = {money.money(enDeviseImputation, deviseImputation)} au taux du jour.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="enc-moyen">Mode de paiement</Label>
              <Select value={methodeId} onValueChange={setMethodeId}>
                <SelectTrigger id="enc-moyen" className="w-full"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {moyens.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enc-reference">
                Référence{methode?.requires_reference ? " *" : ""}
              </Label>
              <Input
                id="enc-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={methode?.requires_reference ? "N° de transaction" : "Facultative"}
              />
              {referenceManquante && saisi > 0 && (
                <p className="text-xs text-destructive">Ce mode de paiement exige une référence.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enc-notes">Note</Label>
            <Textarea id="enc-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* L'imputation ANNONCÉE, calculée comme le serveur la fera. */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {saisi <= 0 ? (
              <p className="text-muted-foreground">
                {ouvertes.length > 0
                  ? `${ouvertes.length > 1 ? `${ouvertes.length} factures ouvertes` : "1 facture ouverte"} en ${deviseImputation}, pour ${money.money(ouvertes.reduce((s, f) => s + f.resteAPayer, 0), deviseImputation)}.`
                  : aDesFactures
                    ? voitToutesLesVentes
                      ? `Aucune facture ouverte en ${deviseImputation}, mais une dette hors facture de ${money.money(nonVisible, deviseImputation)} : elle sera réduite d'abord.`
                      : `Aucune de vos factures n'est ouverte en ${deviseImputation}, mais le client doit encore ${money.money(nonVisible, deviseImputation)} sur celles d'un collègue.`
                    : `Aucune facture ouverte en ${deviseImputation} : le versement sera une avance.`}
              </p>
            ) : (
              <ul className="space-y-1">
                {soldees.length > 0 && (
                  <li>
                    <span className="font-medium">Soldée{soldees.length > 1 ? "s" : ""} :</span> {soldees.join(", ")}
                  </li>
                )}
                {partielle && (
                  <li>
                    <span className="font-medium">Réglée en partie :</span> {partielle}
                  </li>
                )}
                {horsFacture > 0 && (
                  <li>
                    <span className="font-medium">Dette hors factures réduite de :</span>{" "}
                    {money.money(horsFacture, deviseImputation)}
                  </li>
                )}
                {avance > 0 && (
                  <li>
                    <span className="font-medium">Avance :</span> {money.money(avance, deviseImputation)}
                    {nonVisible > 0 && !voitToutesLesVentes ? " (si les factures d'un collègue ne l'absorbent pas)" : ""}
                  </li>
                )}
                {soldees.length === 0 && !partielle && reliquat <= 0 && (
                  <li className="text-muted-foreground">Rien à imputer.</li>
                )}
              </ul>
            )}
            {nonVisible > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {voitToutesLesVentes ? (
                  <>
                    Dette hors factures ouvertes (ajustement, reliquat ancien) : {money.money(nonVisible, deviseImputation)}.
                    Elle est réduite après les factures, avant toute avance.
                  </>
                ) : (
                  <>
                    Autres factures (non visibles) : {money.money(nonVisible, deviseImputation)}. Aperçu sur vos
                    factures seulement : le serveur peut solder d&apos;abord celles d&apos;un collègue.
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={envoi}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={bloque}>
            {envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saisi > 0 ? `Encaisser ${money.money(saisi, devise)}` : "Encaisser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
