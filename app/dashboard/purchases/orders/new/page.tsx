"use client";

/**
 * Passer une commande d'achat.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CRÉER N'ENGAGE NI LE STOCK NI LA CAISSE, ET L'ÉCRAN LE DIT.             │
 * │                                                                          │
 * │ Une commande naît en BROUILLON : rien n'entre en rayon, aucune dette     │
 * │ n'est inscrite, aucun argent ne sort. Tout bouge à la RÉCEPTION, un      │
 * │ geste distinct et confirmé. C'est la règle déjà posée sur les transferts │
 * │ et les ajustements - « créer n'expédie rien, et créer n'applique rien ». │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ C'est un geste de BUREAU : on choisit un fournisseur, on négocie des prix,
 * on relit des conditions. Il reste au back-office, comme l'import Excel.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelectAsync } from "@/components/ui/searchable-select-async";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { jourISO, lireNombreRequis } from "@/lib/stock/nombres";
import { createPurchaseOrder } from "@/actions/purchases.actions";
import { getSuppliers } from "@/actions/contacts.actions";
import { getProducts } from "@/actions/products.actions";
import { getWarehouses } from "@/actions/stock.actions";
import type { Warehouse } from "@/actions/stock.actions";
import {
  getOrganizationCurrencies,
  type OrganizationCurrency,
} from "@/actions/settings.actions";

type Ligne = {
  /** Clé locale : les lignes se réordonnent et se suppriment avant tout envoi. */
  cle: string;
  product: string;
  nom: string;
  quantite: string;
  prix: string;
};

let compteur = 0;
const nouvelleCle = () => `l${++compteur}`;

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();

  const [devisesOrg, setDevisesOrg] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(devisesOrg, defaultCurrency),
    [devisesOrg, defaultCurrency]
  );

  const [entrepots, setEntrepots] = useState<Warehouse[]>([]);
  const [fournisseur, setFournisseur] = useState<string | null>(null);
  const [entrepot, setEntrepot] = useState<string>("");
  const [devise, setDevise] = useState<string>("");
  const [dateCommande, setDateCommande] = useState(jourISO(new Date()));
  const [dateAttendue, setDateAttendue] = useState("");
  const [port, setPort] = useState("");
  const [notes, setNotes] = useState("");
  const [conditions, setConditions] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [enCours, setEnCours] = useState(false);

  const jeton = session?.accessToken;

  useEffect(() => {
    if (!jeton || !organization) return;
    getWarehouses(jeton, organization.id).then((r) => {
      if (r.success && r.data) {
        const liste = r.data;
        setEntrepots(liste);
        // ⚠ UN CHOIX UNIQUE N'EST PAS UN CHOIX : l'entrepôt principal (ou
        // l'unique) est proposé d'emblée. Mais entre plusieurs dépôts sans
        // principal, on ne choisit RIEN - deviner ferait réceptionner au
        // mauvais endroit, et le magasinier ne s'en apercevrait qu'à
        // l'inventaire suivant.
        const defaut = liste.find((w) => w.is_default) ?? (liste.length === 1 ? liste[0] : null);
        if (defaut) setEntrepot(defaut.id);
      }
    });
    getOrganizationCurrencies(jeton, organization.id).then((r) => {
      if (r.success && r.data) {
        setDevisesOrg(r.data);
        if (!devise) setDevise(defaultCurrency.code);
      }
    });
    // `devise` est délibérément hors des dépendances : on ne repose le défaut
    // qu'au premier chargement, sinon tout changement de devise le rétablirait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton, organization, defaultCurrency]);

  const chercherFournisseurs = useCallback(
    async (q: string) => {
      if (!jeton || !organization) return [];
      const r = await getSuppliers(jeton, organization.id, {
        search: q,
        is_active: true,
        page_size: 20,
      });
      return (r.data?.results ?? []).map((s) => ({ value: s.id, label: s.name }));
    },
    [jeton, organization]
  );

  const chercherArticles = useCallback(
    async (q: string) => {
      if (!jeton || !organization) return [];
      const r = await getProducts(jeton, organization.id, {
        search: q,
        // ⚠ PAS de filtre `is_sellable` : un consommable ou une matière
        // première s'achète sans jamais se vendre, et le borner les rendrait
        // introuvables ici. C'est le défaut corrigé sur le mouvement de stock.
        is_active: true,
        page_size: 20,
      });
      return (r.data?.results ?? []).map((p) => ({
        value: p.id,
        label: p.sku ? `${p.name} (${p.sku})` : p.name,
      }));
    },
    [jeton, organization]
  );

  const ajouterLigne = (product: string, nom: string) => {
    if (!product) return;
    setLignes((avant) => {
      // Le même article deux fois n'est pas deux lignes : la seconde saisie
      // REMPLACE la première. Deux lignes du même produit donneraient deux
      // prix négociés contradictoires sur la même commande.
      if (avant.some((l) => l.product === product)) {
        toast.info("Cet article est déjà dans la commande.");
        return avant;
      }
      return [...avant, { cle: nouvelleCle(), product, nom, quantite: "", prix: "" }];
    });
  };

  const poser = (cle: string, champ: "quantite" | "prix", valeur: string) =>
    setLignes((avant) =>
      avant.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l))
    );

  const retirer = (cle: string) =>
    setLignes((avant) => avant.filter((l) => l.cle !== cle));

  /** Les refus par ligne, le corps à envoyer et le total annoncé. */
  const { refus, corps, total } = useMemo(() => {
    const refus: Record<string, string> = {};
    const corps: { product: string; quantity_ordered: string; unit_price: string }[] = [];
    let total = 0;

    for (const l of lignes) {
      const q = lireNombreRequis(l.quantite);
      if (!q.ok) {
        refus[l.cle] = q.phrase;
        continue;
      }
      if (q.valeur <= 0) {
        refus[l.cle] = "Indiquez une quantité à commander.";
        continue;
      }
      const p = lireNombreRequis(l.prix);
      if (!p.ok) {
        refus[l.cle] = p.phrase;
        continue;
      }
      corps.push({
        product: l.product,
        quantity_ordered: String(q.valeur),
        unit_price: String(p.valeur),
      });
      total += q.valeur * p.valeur;
    }
    return { refus, corps, total };
  }, [lignes]);

  const luPort = useMemo(
    () => (port.trim() === "" ? { ok: true as const, valeur: 0 } : lireNombreRequis(port)),
    [port]
  );
  const totalAvecPort = total + (luPort.ok ? luPort.valeur : 0);

  const bloque =
    !fournisseur ||
    corps.length === 0 ||
    corps.length !== lignes.length ||
    !luPort.ok ||
    enCours;

  const enregistrer = async () => {
    if (!jeton || !organization || bloque || !fournisseur) return;
    setEnCours(true);
    const r = await createPurchaseOrder(jeton, organization.id, {
      supplier: fournisseur,
      warehouse: entrepot || null,
      order_date: dateCommande,
      expected_date: dateAttendue || null,
      currency: devise || undefined,
      shipping_cost: luPort.ok ? String(luPort.valeur) : "0",
      notes: notes.trim(),
      terms: conditions.trim(),
      items: corps,
    });
    setEnCours(false);
    if (r.success && r.data) {
      toast.success(`Commande ${r.data.reference} créée en brouillon`);
      router.push(`/dashboard/purchases/orders/${r.data.id}`);
    } else {
      toast.error(r.message ?? "La commande n'a pas pu être créée");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-0.5">
          <Link href="/dashboard/purchases/orders" aria-label="Retour aux commandes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle commande d&apos;achat</h1>
          <p className="text-sm text-muted-foreground">
            La commande naît en brouillon : ni le stock ni la caisse ne bougent
            avant la réception.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Le fournisseur et la livraison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Fournisseur <span className="text-destructive">*</span>
              </Label>
              <SearchableSelectAsync
                value={fournisseur}
                onValueChange={setFournisseur}
                onSearch={chercherFournisseurs}
                placeholder="Choisir un fournisseur"
                searchPlaceholder="Nom du fournisseur…"
                emptyMessage="Aucun fournisseur trouvé"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-warehouse">Entrepôt de livraison</Label>
              <Select value={entrepot} onValueChange={setEntrepot}>
                <SelectTrigger id="po-warehouse">
                  <SelectValue placeholder="Non précisé" />
                </SelectTrigger>
                <SelectContent>
                  {entrepots.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* On DIT ce que coûte l'absence, au lieu de la refuser : une
                  commande sans entrepôt est un brouillon légitime, mais elle
                  ne pourra pas être réceptionnée en l'état. */}
              {!entrepot && (
                <p className="text-sm text-muted-foreground">
                  Sans entrepôt, la commande ne pourra pas être réceptionnée :
                  une réception entre du stock quelque part.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="po-date">Date de commande</Label>
              <Input
                id="po-date"
                type="date"
                value={dateCommande}
                onChange={(e) => setDateCommande(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-expected">Livraison attendue</Label>
              <Input
                id="po-expected"
                type="date"
                value={dateAttendue}
                onChange={(e) => setDateAttendue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-currency">Devise de la commande</Label>
              <Select value={devise} onValueChange={setDevise}>
                <SelectTrigger id="po-currency">
                  <SelectValue placeholder={money.primaryCode} />
                </SelectTrigger>
                <SelectContent>
                  {devisesOrg.map((d) => (
                    <SelectItem key={d.currency_code} value={d.currency_code}>
                      {d.currency_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Articles commandés ({lignes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ajouter un article</Label>
            <SearchableSelectAsync
              value={null}
              onValueChange={() => {}}
              onSelectOption={(o) => ajouterLigne(o.value, o.label)}
              onSearch={chercherArticles}
              placeholder="Chercher un article…"
              searchPlaceholder="Nom ou code de l'article…"
              emptyMessage="Aucun article trouvé"
            />
          </div>

          {lignes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ajoutez au moins un article : une commande vide n&apos;engage rien
              et ne se réceptionne pas.
            </p>
          ) : (
            <div className="space-y-3">
              {lignes.map((l) => (
                <div key={l.cle} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="font-medium">{l.nom}</span>
                    {/* Le retrait a sa PROPRE cible : toucher la ligne ne doit
                        pas l'effacer, c'est le défaut corrigé sur la feuille
                        de devis du terminal. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => retirer(l.cle)}
                      aria-label={`Retirer ${l.nom}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`q-${l.cle}`}>Quantité</Label>
                      <Input
                        id={`q-${l.cle}`}
                        inputMode="decimal"
                        value={l.quantite}
                        onChange={(e) => poser(l.cle, "quantite", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`p-${l.cle}`}>
                        Prix d&apos;achat unitaire ({devise || money.primaryCode})
                      </Label>
                      <Input
                        id={`p-${l.cle}`}
                        inputMode="decimal"
                        value={l.prix}
                        onChange={(e) => poser(l.cle, "prix", e.target.value)}
                      />
                    </div>
                  </div>
                  {refus[l.cle] && (
                    <p className="mt-2 text-sm text-destructive">{refus[l.cle]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Frais, notes et conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 md:max-w-xs">
            <Label htmlFor="po-shipping">
              Frais de transport ({devise || money.primaryCode})
            </Label>
            <Input
              id="po-shipping"
              inputMode="decimal"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="0"
            />
            {!luPort.ok && (
              <p className="text-sm text-destructive">{luPort.phrase}</p>
            )}
            {/* ⚠ Le transport s'inscrit à la PREMIÈRE réception validée, et une
                seule fois : il est porté par l'enveloppe et n'est pas
                divisible. Le dire évite de le chercher dans les lignes. */}
            <p className="text-sm text-muted-foreground">
              Il sera dû à la première réception validée, en une seule fois.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-notes">Notes</Label>
              <Textarea
                id="po-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="po-terms">Conditions</Label>
              <Textarea
                id="po-terms"
                rows={3}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Délai de paiement, pénalités, garanties…"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total de la commande</p>
          {/* Le total est un APERÇU : le serveur refait l'arithmétique, taxes
              et remises de ligne comprises, et c'est la sienne qui est écrite. */}
          <p className="text-xl font-semibold">
            {money.money(totalAvecPort, devise || money.primaryCode)}
          </p>
          <p className="text-xs text-muted-foreground">
            Aperçu : le serveur refait le calcul à l&apos;enregistrement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/purchases/orders">Annuler</Link>
          </Button>
          <Button onClick={enregistrer} disabled={bloque}>
            {enCours ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Créer la commande
          </Button>
        </div>
      </div>
    </div>
  );
}
