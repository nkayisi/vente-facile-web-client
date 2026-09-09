"use client";

/**
 * Créer un devis.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN DEVIS N'ENGAGE PAS LE STOCK, ET L'ÉCRAN LE DIT.                      │
 * │                                                                          │
 * │ La réservation n'a lieu qu'à la CONVERSION, qui inscrit une dette comme  │
 * │ une vente à crédit. Sans cette phrase, un commerçant croit avoir mis la  │
 * │ marchandise de côté, et la vend entre-temps.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ `valid_until` EST OBLIGATOIRE, ET UNE DATE PASSÉE DONNE UN DEVIS        │
 * │ PÉRIMÉ-NÉ.                                                               │
 * │                                                                          │
 * │ Un devis qui n'expire jamais n'en est pas un - le serveur le refuse. Et  │
 * │ une date d'hier a la bonne FORME : elle passe le contrôle, s'enregistre, │
 * │ et le commerçant a proposé un prix sur un papier qui ne vaut déjà plus   │
 * │ rien. Le champ porte donc son plancher, et quatre échéances usuelles     │
 * │ précèdent la saisie : taper une date au clavier pour la valeur que tout  │
 * │ le monde choisit est du travail pour rien.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { createQuotation } from "@/actions/sales.actions";
import { getProducts, type Product } from "@/actions/products.actions";
import { getCustomers, type Customer } from "@/actions/contacts.actions";

interface LigneDevis {
  cle: string;
  product: string;
  product_name: string;
  quantity: string;
  unit_price: string;
}

/** Les échéances usuelles, en jours. */
const ECHEANCES = [7, 15, 30, 60];

function jourISO(d: Date): string {
  const deux = (n: number) => (n < 10 ? `0${n}` : String(n));
  // Sur les composantes LOCALES : `toISOString()` bascule en UTC, et une
  // échéance choisie le soir à Kinshasa s'y daterait du lendemain.
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

function dansNJours(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return jourISO(d);
}

export function QuotationDialog({
  open,
  onOpenChange,
  accessToken,
  organizationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  organizationId: string;
  onCreated: () => void;
}) {
  const { currency } = useCurrency();
  const money = useMemo(() => createMoneyHelpers([], currency), [currency]);

  const [produits, setProduits] = useState<Product[]>([]);
  const [clients, setClients] = useState<Customer[]>([]);
  const [client, setClient] = useState<string>("");
  const [validite, setValidite] = useState<string>(dansNJours(30));
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneDevis[]>([]);
  const [choixProduit, setChoixProduit] = useState<string>("");
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    // En PARALLÈLE : les deux listes ne dépendent pas l'une de l'autre, et les
    // enchaîner ferait deux allers-retours là où la latence domine.
    const [p, c] = await Promise.all([
      getProducts(accessToken, organizationId, { page_size: 200 }),
      getCustomers(accessToken, organizationId, { page_size: 200 }),
    ]);
    setProduits(p.success && p.data ? p.data.results : []);
    // `getCustomers` rend une réponse PAGINÉE, contrairement à ce que son type
    // laisse croire au premier regard : sans `.results`, c'est l'enveloppe
    // entière qui atterrit dans l'état, et la liste sort vide sans une erreur.
    setClients(c.success && c.data ? c.data.results : []);
  }, [accessToken, organizationId]);

  useEffect(() => {
    if (open) charger();
  }, [open, charger]);

  const ajouter = (productId: string) => {
    const produit = produits.find((p) => p.id === productId);
    if (!produit) return;
    setLignes((prev) => [
      ...prev,
      {
        cle: `${productId}-${Date.now()}`,
        product: productId,
        product_name: produit.name,
        quantity: "1",
        unit_price: produit.selling_price ?? "0",
      },
    ]);
    setChoixProduit("");
  };

  const majLigne = (cle: string, patch: Partial<LigneDevis>) =>
    setLignes((prev) => prev.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));

  const total = useMemo(
    () =>
      lignes.reduce(
        (t, l) => t + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0),
        0
      ),
    [lignes]
  );

  const datePassee = validite !== "" && validite < jourISO(new Date());
  const valide =
    lignes.length > 0 &&
    validite !== "" &&
    !datePassee &&
    lignes.every(
      (l) => (parseFloat(l.quantity) || 0) > 0 && (parseFloat(l.unit_price) || 0) >= 0
    );

  const enregistrer = async () => {
    if (!valide) return;
    setEnCours(true);
    const reponse = await createQuotation(accessToken, organizationId, {
      customer: client || undefined,
      valid_until: validite,
      notes: notes.trim() || undefined,
      items: lignes.map((l) => ({
        product: l.product,
        quantity: parseFloat(l.quantity) || 0,
        unit_price: parseFloat(l.unit_price) || 0,
      })),
    });
    setEnCours(false);

    if (reponse.success) {
      toast.success("Devis créé");
      setLignes([]);
      setClient("");
      setNotes("");
      setValidite(dansNJours(30));
      onOpenChange(false);
      onCreated();
    } else {
      toast.error(reponse.message || "Le devis n'a pas pu être créé");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nouveau devis</DialogTitle>
          <DialogDescription>
            Un devis <strong>n&apos;engage pas le stock</strong> : la réservation
            n&apos;a lieu qu&apos;à sa conversion en vente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Client</Label>
              <SearchableSelect
                options={[
                  { value: "", label: "Client anonyme" },
                  ...clients.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={client}
                onValueChange={setClient}
                placeholder="Client anonyme"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="validite">Valable jusqu&apos;au</Label>
              <Input
                id="validite"
                type="date"
                min={jourISO(new Date())}
                value={validite}
                onChange={(e) => setValidite(e.target.value)}
                className={datePassee ? "border-destructive" : ""}
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {ECHEANCES.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setValidite(dansNJours(n))}
                  >
                    {n} j
                  </Button>
                ))}
              </div>
              {datePassee && (
                <p className="text-xs text-destructive">
                  Un devis ne peut pas naître périmé : choisissez une date à venir.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Ajouter un article</Label>
            <SearchableSelect
              options={produits.map((p) => ({
                value: p.id,
                label: `${p.name}${p.sku ? ` (${p.sku})` : ""}`,
              }))}
              value={choixProduit}
              onValueChange={ajouter}
              placeholder="Rechercher un article…"
            />
          </div>

          {lignes.length > 0 && (
            <div className="space-y-2">
              {lignes.map((l) => (
                <div key={l.cle} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{l.product_name}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLignes((prev) => prev.filter((x) => x.cle !== l.cle))}
                      aria-label={`Retirer ${l.product_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantité</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="w-24"
                        value={l.quantity}
                        onChange={(e) => majLigne(l.cle, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Prix unitaire</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="w-32"
                        value={l.unit_price}
                        onChange={(e) => majLigne(l.cle, { unit_price: e.target.value })}
                      />
                    </div>
                    <div className="flex items-end pb-2 text-sm text-muted-foreground">
                      =
                      <span className="ml-1 font-mono font-medium text-foreground">
                        {money.money(
                          (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0),
                          money.primaryCode
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-1 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-semibold">
                  {money.money(total, money.primaryCode)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="notes-devis">Notes</Label>
            <Textarea
              id="notes-devis"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions particulières, délai de livraison…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>
            Annuler
          </Button>
          <Button onClick={enregistrer} disabled={!valide || enCours}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plus className="mr-2 h-4 w-4" />
            Créer le devis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
