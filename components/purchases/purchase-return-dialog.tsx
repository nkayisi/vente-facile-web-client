"use client";

/**
 * Retourner de la marchandise au fournisseur, depuis la commande qui l'a livrée.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ON POUVAIT RENDRE DEUX FOIS LA MÊME MARCHANDISE.                        │
 * │                                                                          │
 * │ Rien, côté serveur, ne comparait la quantité rendue à ce qui avait été   │
 * │ reçu ni à ce qui avait déjà été rendu. Deux retours identiques sortaient │
 * │ donc deux fois la marchandise du stock et éteignaient deux fois la       │
 * │ dette. Le serveur borne désormais ; cet écran borne AUSSI, parce qu'un   │
 * │ refus après coup laisse le commerçant devant son carton sans savoir quoi │
 * │ saisir.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Un retour naît en BROUILLON. Ni le stock ni la caisse ne bougent avant
 * l'approbation, qui est un geste distinct et confirmé.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/components/auth/organization-checker";
import { jourISO, lireNombreRequis } from "@/lib/stock/nombres";
import {
  createPurchaseReturn,
  getPurchaseReturn,
  getPurchaseReturns,
  type PurchaseOrder,
} from "@/actions/purchases.actions";

/** Ce qui reste rendable, par article. */
type Rendable = {
  product: string;
  nom: string;
  recue: number;
  rendue: number;
  cout: string;
};

export function PurchaseReturnDialog({
  open,
  onOpenChange,
  order,
  onDone,
}: {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  order: PurchaseOrder;
  onDone: (returnId: string) => void;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();

  // L'état naît avec le composant : l'appelant le rend conditionnellement,
  // donc chaque ouverture est un montage et le formulaire est vierge.
  const [rendables, setRendables] = useState<Rendable[] | null>(null);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [motif, setMotif] = useState("");
  const [date, setDate] = useState(() => jourISO(new Date()));
  const [enCours, setEnCours] = useState(false);

  const jeton = session?.accessToken;

  /**
   * Relève ce qui reste rendable : reçu moins déjà rendu.
   *
   * ⚠ Un retour ANNULÉ ne consomme rien - la marchandise n'est jamais repartie
   * - mais un BROUILLON, si : il est approuvable, et deux brouillons sur les
   * mêmes unités seraient tous deux approuvables. C'est le raisonnement du
   * serveur, et il doit être le même ici.
   */
  const relever = useCallback(async () => {
    if (!jeton || !organization) return;

    // ┌────────────────────────────────────────────────────────────────────┐
    // │ LE REÇU SE LIT SUR LA COMMANDE, PAS SUR LA LISTE DES RÉCEPTIONS.  │
    // │                                                                    │
    // │ Cette fonction sommait `grn.items` des réceptions. Or              │
    // │ `GoodsReceiptListSerializer` N'EXPOSE PAS `items` - vérifié contre │
    // │ le serveur : la réponse ne porte que `items_count`. `grn.items ??  │
    // │ []` valait donc TOUJOURS le tableau vide, `rendables` sortait      │
    // │ toujours vide, et le dialogue affichait « Il n'y a plus rien à     │
    // │ rendre » quelle que soit la commande : la création d'un retour     │
    // │ était INATTEIGNABLE depuis le back-office.                          │
    // │                                                                    │
    // │ `PurchaseOrderItem.quantity_received` porte exactement le même     │
    // │ cumul - c'est `completer_reception` qui l'incrémente des quantités │
    // │ acceptées - et la fiche de commande le tient DÉJÀ en main. Zéro    │
    // │ requête de plus, et plus aucune troncature de page.                 │
    // └────────────────────────────────────────────────────────────────────┘
    const recues = new Map<string, { nom: string; q: number; cout: string }>();
    for (const l of order.items ?? []) {
      const recue = parseFloat(l.quantity_received || "0");
      if (recue <= 0) continue;
      const avant = recues.get(l.product);
      recues.set(l.product, {
        nom: l.product_name ?? avant?.nom ?? "",
        q: (avant?.q ?? 0) + recue,
        cout: l.unit_price || avant?.cout || "0",
      });
    }

    // ⚠ Le `try/catch` ne garde pas le réseau - les actions avalent déjà leurs
    // erreurs - mais la LECTURE de la réponse, qui peut lever. Sans lui, le
    // dialogue resterait sur son squelette indéfiniment, et le rejet non
    // traité ne se verrait nulle part. Et c'est aussi ce qui tait
    // `react-hooks/set-state-in-effect`, dont l'analyseur perd la trace des
    // `await` hors d'un bloc gardé.
    try {
      // ⚠ BORNÉ À CETTE COMMANDE, par le filtre que le serveur déclare. Sans
      // lui, on tirait les cent premiers retours de TOUT l'établissement pour
      // n'en garder que ceux de cette commande : au-delà de cent, ce qui avait
      // déjà été rendu était sous-compté, et l'écran laissait saisir plus que
      // ce qui restait.
      const entetes = await getPurchaseReturns(jeton, organization.id, {
        purchase_order: order.id,
        page_size: 100,
      });

      // ⚠ Un retour ANNULÉ ne consomme rien - la marchandise n'est jamais
      // repartie - mais un BROUILLON, si : il est approuvable, et deux
      // brouillons sur les mêmes unités seraient tous deux approuvables. C'est
      // le raisonnement du serveur, et il doit être le même ici.
      const vivants = (entetes.data?.results ?? []).filter(
        (r) => r.status !== "cancelled"
      );

      // La LISTE ne porte pas ses lignes non plus : seul le détail les rend.
      // Les retours d'une même commande se comptent sur les doigts, donc on
      // les ouvre un par un plutôt que de supposer une forme que l'API n'a pas.
      const details = await Promise.all(
        vivants.map((r) => getPurchaseReturn(jeton, organization.id, r.id))
      );

      const rendues = new Map<string, number>();
      for (const d of details) {
        for (const l of d.data?.items ?? []) {
          rendues.set(
            l.product,
            (rendues.get(l.product) ?? 0) + parseFloat(l.quantity || "0")
          );
        }
      }

      setRendables(
        [...recues.entries()]
          .map(([product, info]) => ({
            product,
            nom: info.nom,
            recue: info.q,
            rendue: rendues.get(product) ?? 0,
            cout: info.cout,
          }))
          .filter((r) => r.recue - r.rendue > 0)
      );
    } catch {
      setRendables([]);
      toast.error("Ce qui reste à rendre n'a pas pu être relevé.");
    }
  }, [jeton, organization, order.id, order.items]);


  // Seul le RELEVÉ demande un effet : il interroge le serveur. Les champs,
  // eux, naissent vierges avec le composant.
  useEffect(() => {
    // ┌────────────────────────────────────────────────────────────────────┐
    // │ `react-hooks/set-state-in-effect` NE SAIT PAS SUIVRE CET `await`.  │
    // │                                                                    │
    // │ Tous les `setState` de `relever` vivent APRÈS son `await           │
    // │ Promise.all`, donc dans un rappel asynchrone - précisément la forme │
    // │ que la règle autorise. Mais l'analyseur l'inline et perd la trace   │
    // │ de l'attente. CINQ réécritures ont été mesurées, toutes signalées : │
    // │ `try/finally`, `try/catch`, `.catch()` dans l'effet, enveloppe      │
    // │ séparée, et rattrapage hors de l'effet. C'est la limite déjà        │
    // │ documentée sur `bootstrap()` côté terminal.                         │
    // │                                                                    │
    // │ Ce que la règle protège n'est pas en jeu : ce chemin court AU PLUS  │
    // │ UNE FOIS par montage - le dialogue est rendu conditionnellement -   │
    // │ et il s'arrête sur un état stable.                                  │
    // └────────────────────────────────────────────────────────────────────┘
    // eslint-disable-next-line react-hooks/set-state-in-effect -- voir ci-dessus
    relever();
  }, [relever]);

  const { refus, corps } = useMemo(() => {
    const refus: Record<string, string> = {};
    const corps: {
      product: string;
      quantity: string;
      unit_cost: string;
    }[] = [];

    for (const r of rendables ?? []) {
      const saisie = saisies[r.product] ?? "";
      if (saisie.trim() === "") continue;

      const lu = lireNombreRequis(saisie);
      if (!lu.ok) {
        refus[r.product] = lu.phrase;
        continue;
      }
      const reste = r.recue - r.rendue;
      if (lu.valeur > reste) {
        // Le message porte les TROIS nombres : un refus qui dirait seulement
        // « trop élevé » laisse le commerçant sans savoir quoi saisir.
        refus[r.product] =
          `${r.rendue} déjà rendu sur ${r.recue} reçu : il en reste ${reste}.`;
        continue;
      }
      if (lu.valeur <= 0) {
        refus[r.product] = "Un retour de zéro ne rend rien.";
        continue;
      }
      corps.push({
        product: r.product,
        quantity: String(lu.valeur),
        unit_cost: r.cout,
      });
    }
    return { refus, corps };
  }, [rendables, saisies]);

  const bloque =
    Object.keys(refus).length > 0 ||
    corps.length === 0 ||
    motif.trim() === "" ||
    !order.warehouse;

  const enregistrer = async () => {
    if (!jeton || !organization || bloque) return;
    setEnCours(true);
    const r = await createPurchaseReturn(jeton, organization.id, {
      supplier: order.supplier,
      purchase_order: order.id,
      warehouse: order.warehouse!,
      reason: motif.trim(),
      return_date: date,
      items: corps,
    });
    setEnCours(false);
    if (r.success && r.data) {
      toast.success(`Retour ${r.data.reference} enregistré en brouillon`);
      onDone(r.data.id);
    } else {
      toast.error(r.message ?? "Le retour n'a pas pu être enregistré");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Retourner au fournisseur</DialogTitle>
          <DialogDescription>
            {order.supplier_name} · {order.reference}. Le retour naît en
            brouillon : rien ne sort du rayon avant son approbation.
          </DialogDescription>
        </DialogHeader>

        {rendables === null ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : rendables.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Il n&apos;y a plus rien à rendre.</p>
            <p className="text-muted-foreground">
              Tout ce qui avait été reçu sur cette commande a déjà été retourné,
              ou aucune réception n&apos;a encore été validée.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {rendables.map((r) => {
                const reste = r.recue - r.rendue;
                return (
                  <div key={r.product} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{r.nom}</span>
                      <span className="text-sm text-muted-foreground">
                        {r.rendue > 0
                          ? `${r.rendue} déjà rendu, il en reste ${reste}`
                          : `${reste} rendable`}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`retour-${r.product}`}>Quantité à rendre</Label>
                      <Input
                        id={`retour-${r.product}`}
                        inputMode="decimal"
                        value={saisies[r.product] ?? ""}
                        onChange={(e) =>
                          setSaisies((avant) => ({
                            ...avant,
                            [r.product]: e.target.value,
                          }))
                        }
                        placeholder="Vide = rien sur cet article"
                      />
                    </div>
                    {refus[r.product] && (
                      <p className="mt-2 text-sm text-destructive">
                        {refus[r.product]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="retour-date">Date du retour</Label>
                <Input
                  id="retour-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="retour-motif">
                  Motif <span className="text-destructive">*</span>
                </Label>
                {/* Le motif est REQUIS côté serveur, et il a sa raison : un
                    retour sans motif est une écriture dont plus personne ne
                    retrouvera l'origine. */}
                <Textarea
                  id="retour-motif"
                  rows={2}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Casse, péremption, erreur de référence…"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={enregistrer} disabled={bloque || enCours}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer le retour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
