"use client";

/**
 * Réquisitions de produits : ce qu'il faut acheter.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE N'EST PAS UNE COMMANDE D'ACHAT.                                      │
 * │                                                                          │
 * │ `PurchaseOrder.supplier` est obligatoire côté serveur, alors qu'une      │
 * │ réquisition dit « il nous manque ceci » sans qu'on sache encore chez qui │
 * │ l'acheter - c'est souvent la question qu'on se pose EN LA LISANT. Elle   │
 * │ n'achète rien et ne bouge aucun stock, même approuvée.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le formulaire s'ouvre DÉJÀ REMPLI : `GET /requisitions/proposer/` rend les
 * articles sous leur seuil. Un formulaire vide ferait chercher un par un les
 * articles qu'on vient de voir manquer en rayon, c'est-à-dire refaire à la
 * main ce que `reorder_point` existe pour faire.
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, CheckCircle, Clock, Loader2, Plus, Search,
  ShoppingBasket, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DataPagination } from "@/components/shared/DataPagination";
import { ExportMenu } from "@/components/shared/ExportMenu";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { useOrganization } from "@/components/auth/organization-checker";
import { usePerimeter } from "@/hooks/use-perimeter";
import { messageDeRefus } from "@/lib/perimeter-refusal";
import { formatDate } from "@/lib/format";
import {
  createRequisition, exportRequisition, getRequisitionProposal, getRequisitions,
  getWarehouses, transitionRequisition,
  type Requisition, type RequisitionProposal, type Warehouse,
} from "@/actions/stock.actions";

type Statut = Requisition["status"];

const STATUT: Record<Statut, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Brouillon", color: "bg-muted text-muted-foreground", icon: Clock },
  submitted: { label: "Soumise", color: "bg-warning/15 text-warning", icon: Clock },
  approved: { label: "Approuvée", color: "bg-success/15 text-success", icon: CheckCircle },
  rejected: { label: "Rejetée", color: "bg-destructive/15 text-destructive", icon: XCircle },
  cancelled: { label: "Annulée", color: "bg-muted text-muted-foreground", icon: X },
};

/** Une ligne du bordereau en cours de saisie. */
interface LigneSaisie extends RequisitionProposal {
  retenue: boolean;
  /** La saisie BRUTE : le champ garde ce qui est tapé. */
  quantite: string;
}

export default function RequisitionsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { organization } = useOrganization();
  const jeton = session?.accessToken;

  const [chargement, setChargement] = useState(true);
  const [refus, setRefus] = useState<string | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [entrepots, setEntrepots] = useState<Warehouse[]>([]);
  const [recherche, setRecherche] = useState("");
  /**
   * La recherche DIFFÉRÉE, et c'est elle que `charger` lit.
   *
   * ┌──────────────────────────────────────────────────────────────────────────┐
   * │ UNE REQUÊTE PAR FRAPPE, ET LA PLUS LENTE POUVAIT GAGNER.                │
   * │                                                                          │
   * │ `recherche` était une dépendance directe de `charger`, que l'effet       │
   * │ relance à chaque changement d'identité : taper « savon » émettait CINQ   │
   * │ `GET /requisitions/`, et comme rien ne les séquence, une réponse         │
   * │ précoce plus lente pouvait arriver EN DERNIER et rendre les résultats de │
   * │ « sa » sous la requête « savon ».                                        │
   * │                                                                          │
   * │ Cette page avait déjà traité le défaut VOISIN - son drapeau de premier   │
   * │ chargement, qui empêche le champ de se démonter - mais pas celui-ci.     │
   * └──────────────────────────────────────────────────────────────────────────┘
   *
   * Les deux pages sœurs établissent la convention à 350 ms :
   * `stock/movements/page.tsx` et `sales/history/page.tsx`.
   */
  const [rechercheDifferee, setRechercheDifferee] = useState("");
  const [statut, setStatut] = useState<string>("all");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [suivante, setSuivante] = useState(false);
  const [precedente, setPrecedente] = useState(false);
  const parPage = 20;

  const [perimetreChoisi, setPerimetreChoisi] = useState<PerimeterValue>({ warehouse: null, user: null });
  // ENTREPÔT SEUL : `requisitions` n'a pas de portée par créateur côté serveur.
  // Le champ « Utilisateur » se ferme AVEC son motif plutôt que de disparaître.
  const perimetre = usePerimeter();

  const [dialogue, setDialogue] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  // Formulaire
  const [entrepot, setEntrepot] = useState("");
  const [rupturesSeules, setRupturesSeules] = useState(false);
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [chargementProposition, setChargementProposition] = useState(false);

  const effectif = perimetre.effective({
    warehouse: perimetreChoisi.warehouse ?? undefined,
  });

  const charger = useCallback(async () => {
    if (!jeton || !organization) return;

    /**
     * ⚠ LE `try/finally` N'EST PAS DÉCORATIF : sans lui, une exception laisse
     * la page sur son tourniquet, indéfiniment, sans rien dire. Les deux
     * actions avalent déjà leurs erreurs réseau, mais la lecture de la réponse
     * peut lever, et un rejet non traité dans un effet ne se voit nulle part.
     * C'est aussi la forme des deux pages voisines du stock.
     */
    try {
      const [liste, depots] = await Promise.all([
        getRequisitions(jeton, organization.id, {
          search: rechercheDifferee || undefined,
          status: statut === "all" ? undefined : statut,
          warehouse: effectif.warehouse ?? undefined,
          page,
          page_size: parPage,
        }),
        entrepots.length === 0
          ? getWarehouses(jeton, organization.id)
          : Promise.resolve(null),
      ]);

      if (liste.success && liste.data) {
        setRequisitions(liste.data.results);
        setTotal(liste.data.count);
        setSuivante(Boolean(liste.data.next));
        setPrecedente(Boolean(liste.data.previous));
        setRefus(null);
      } else {
        // ⚠ UN REFUS NE LAISSE PAS LA LISTE PRÉCÉDENTE SOUS LES NOUVELLES
        // PUCES : on le NOMME, sinon l'écran affiche « Entrepôt B » au-dessus
        // des chiffres de A.
        setRefus(messageDeRefus(liste));
        setRequisitions([]);
      }
      if (depots?.success && depots.data) {
        setEntrepots(depots.data);
      }
    } finally {
      /**
       * Le drapeau de PREMIER chargement ne se relève jamais : c'est ce qui
       * empêche le champ de recherche de se démonter à chaque frappe, donc de
       * perdre le focus - le défaut qu'« Historique des ventes » a dû corriger.
       */
      setChargement(false);
    }
  }, [
    jeton, organization, rechercheDifferee, statut, effectif.warehouse, page,
    entrepots.length,
  ]);

  // La frappe retombée, la requête part. Le nettoyage annule la précédente :
  // c'est lui qui garantit qu'il n'en part qu'UNE.
  useEffect(() => {
    const minuteur = setTimeout(() => setRechercheDifferee(recherche.trim()), 350);
    return () => clearTimeout(minuteur);
  }, [recherche]);

  useEffect(() => {
    if (organization) {
      charger();
    }
  }, [organization, charger]);

  /** Tout changement de filtre ramène à la page 1 : filtrer depuis la page 3
   *  rendrait une page vide, qui se lit comme une absence de données. */
  const filtrer = (geste: () => void) => {
    geste();
    setPage(1);
  };

  const chargerProposition = useCallback(
    async (depot: string, ruptures: boolean) => {
      if (!jeton || !organization || !depot) return;
      setChargementProposition(true);
      const res = await getRequisitionProposal(jeton, organization.id, depot, ruptures);
      if (res.success && res.data) {
        setLignes(
          res.data.items.map((p) => ({
            ...p,
            retenue: true,
            quantite: String(p.suggested),
          }))
        );
      } else {
        toast.error(res.message ?? "La proposition n'a pas pu être calculée");
        setLignes([]);
      }
      setChargementProposition(false);
    },
    [jeton, organization]
  );

  const ouvrirDialogue = () => {
    const defaut =
      entrepots.find((e) => e.is_default && e.is_active)?.id ??
      (entrepots.filter((e) => e.is_active).length === 1
        ? entrepots.find((e) => e.is_active)?.id
        : "") ??
      "";
    setEntrepot(defaut);
    setNotes("");
    setRupturesSeules(false);
    setLignes([]);
    setDialogue(true);
    if (defaut) void chargerProposition(defaut, false);
  };

  const retenues = lignes.filter((l) => l.retenue && Number(l.quantite) > 0);

  const enregistrer = async () => {
    if (!jeton || !organization || !entrepot || retenues.length === 0) return;
    setEnvoi(true);
    const res = await createRequisition(jeton, organization.id, {
      warehouse: entrepot,
      notes,
      // ⚠ Ni stock ni seuil : le serveur les RELÈVE. Les envoyer permettrait
      // d'écrire une pénurie qui n'existe pas.
      items: retenues.map((l) => ({
        product: l.product,
        quantity_requested: l.quantite,
      })),
    });
    setEnvoi(false);
    if (res.success && res.data) {
      toast.success(`Réquisition ${res.data.reference} créée`);
      setDialogue(false);
      void charger();
    } else {
      toast.error(res.message ?? "La réquisition n'a pas pu être créée");
    }
  };

  const decider = async (
    r: Requisition,
    action: "submit" | "cancel" | "approve" | "reject"
  ) => {
    if (!jeton || !organization) return;
    const res = await transitionRequisition(jeton, organization.id, r.id, action);
    if (res.success) {
      toast.success("Réquisition mise à jour");
      void charger();
    } else {
      toast.error(res.message ?? "L'opération n'a pas pu être effectuée");
    }
  };

  if (chargement) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/stock")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Réquisitions</h1>
            <p className="text-sm text-muted-foreground">
              Ce qu&apos;il faut acheter ({total} au total)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={ouvrirDialogue}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle réquisition
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une référence..."
              value={recherche}
              onChange={(e) => filtrer(() => setRecherche(e.target.value))}
              className="pl-9"
            />
          </div>
          <Select value={statut} onValueChange={(v) => filtrer(() => setStatut(v))}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(Object.keys(STATUT) as Statut[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUT[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PerimeterFilters
            value={perimetreChoisi}
            onChange={(v) => filtrer(() => setPerimetreChoisi(v))}
            withUser={false}
          />
        </CardContent>
      </Card>

      {refus ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{refus}</p>
          </CardContent>
        </Card>
      ) : requisitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBasket className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Aucune réquisition</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {recherche || statut !== "all"
                ? "Aucune réquisition ne correspond à ces filtres."
                : "Créez-en une : les articles déjà sous leur seuil vous seront proposés."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Référence</th>
                    <th className="px-4 py-3 font-medium">Entrepôt</th>
                    <th className="px-4 py-3 font-medium">Demandée le</th>
                    <th className="px-4 py-3 text-right font-medium">Articles</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((r) => {
                    const s = STATUT[r.status];
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{r.reference}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.warehouse_name ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(r.requested_at)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.items?.length ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={s.color} variant="secondary">
                            {s.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {r.status === "draft" ? (
                              <Button size="sm" variant="outline" onClick={() => void decider(r, "submit")}>
                                Soumettre
                              </Button>
                            ) : null}
                            {r.status === "submitted" ? (
                              <>
                                {/* ⚠ « Rejeter » n'est PAS l'action destructrice :
                                    rejeter n'engage rien, approuver engage de
                                    l'argent. D'où l'ordre, et les variantes. */}
                                <Button size="sm" variant="outline" onClick={() => void decider(r, "reject")}>
                                  Rejeter
                                </Button>
                                <Button size="sm" onClick={() => void decider(r, "approve")}>
                                  <Check className="mr-1 h-3 w-3" />
                                  Approuver
                                </Button>
                              </>
                            ) : null}
                            <ExportMenu
                              size="sm"
                              label="Bordereau"
                              targets={[
                                {
                                  key: `requisition-${r.id}`,
                                  label: `Bordereau ${r.reference}`,
                                  run: (format) =>
                                    exportRequisition(jeton!, organization!.id, r.id, format),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {total > parPage ? (
        <DataPagination
          currentPage={page}
          totalPages={Math.ceil(total / parPage)}
          hasNext={suivante}
          hasPrevious={precedente}
          onPageChange={setPage}
        />
      ) : null}

      <Dialog open={dialogue} onOpenChange={setDialogue}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouvelle réquisition</DialogTitle>
            <DialogDescription>
              Les articles déjà sous leur point de réapprovisionnement sont proposés
              d&apos;emblée. Corrigez les quantités : le fournisseur ne vend pas toujours
              à l&apos;unité.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Entrepôt *</Label>
                <Select
                  value={entrepot}
                  onValueChange={(v) => {
                    setEntrepot(v);
                    // La saisie appartient à l'entrepôt : la garder ferait
                    // demander pour le dépôt B des quantités relevées sur A.
                    setLignes([]);
                    void chargerProposition(v, rupturesSeules);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un entrepôt" />
                  </SelectTrigger>
                  <SelectContent>
                    {entrepots
                      .filter((e) => e.is_active)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  id="ruptures"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={rupturesSeules}
                  onChange={(e) => {
                    setRupturesSeules(e.target.checked);
                    if (entrepot) void chargerProposition(entrepot, e.target.checked);
                  }}
                />
                <Label htmlFor="ruptures" className="text-sm font-normal">
                  Ruptures seulement
                </Label>
              </div>
            </div>

            {chargementProposition ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : lignes.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                {entrepot
                  ? "Aucun article n'est sous son point de réapprovisionnement dans ce dépôt."
                  : "Choisissez un entrepôt pour voir ce qui manque."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr className="text-left">
                      <th className="w-10 px-3 py-2" />
                      <th className="px-3 py-2 font-medium">Article</th>
                      <th className="px-3 py-2 text-right font-medium">En rayon</th>
                      <th className="px-3 py-2 text-right font-medium">Seuil</th>
                      <th className="px-3 py-2 text-right font-medium">À demander</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => (
                      <tr key={l.product} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            aria-label={`Demander ${l.product_name}`}
                            checked={l.retenue}
                            onChange={(e) =>
                              setLignes((avant) =>
                                avant.map((x, j) =>
                                  j === i ? { ...x, retenue: e.target.checked } : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{l.product_name}</div>
                          {l.product_sku ? (
                            <div className="text-xs text-muted-foreground">{l.product_sku}</div>
                          ) : null}
                        </td>
                        {/* Le stock ET le seuil : c'est ce qui JUSTIFIE la
                            demande, et ce que le bordereau imprimera. */}
                        <td className="px-3 py-2 text-right tabular-nums">{l.stock}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {l.reorder_point}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={l.quantite}
                            disabled={!l.retenue}
                            onChange={(e) =>
                              setLignes((avant) =>
                                avant.map((x, j) =>
                                  j === i ? { ...x, quantite: e.target.value } : x
                                )
                              )
                            }
                            className="ml-auto w-28 text-right"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Chez qui l'acheter, pour quand…"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {retenues.length === 0
                ? "Cochez au moins un article à demander."
                : `${retenues.length} ${retenues.length > 1 ? "articles" : "article"} à demander`}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogue(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => void enregistrer()}
                disabled={retenues.length === 0 || !entrepot || envoi}
              >
                {envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enregistrer la demande
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
