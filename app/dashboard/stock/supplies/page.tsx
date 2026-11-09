"use client";

/**
 * Approvisionnement de MASSE : la feuille, et rien d'autre.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CHAQUE LIGNE EST LE FORMULAIRE D'UN SEUL ARTICLE.                       │
 * │                                                                          │
 * │ Le dialogue « Nouveau mouvement » rend, par canal, la quantité, le prix  │
 * │ d'achat, le prix de vente et LA MARGE. Cette feuille alignait quatre     │
 * │ champs nus : le marchand ne retrouvait pas ses gestes, et il ne voyait   │
 * │ nulle part s'il allait vendre à perte. Elle emprunte désormais les mêmes │
 * │ `ChannelPriceBlock`, avec les mêmes mots.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LE DÉVOILEMENT EST PROGRESSIF, ET IL EST OBLIGATOIRE. La feuille porte
 * jusqu'à `LIGNES_MAX = 300` lignes ; deux blocs de prix complets par ligne
 * donneraient une page de plusieurs dizaines de milliers de pixels. Les prix se
 * déplient donc sur les lignes RÉELLEMENT reçues (`pricesVisible={total > 0}`),
 * ou à la demande par le chevron. C'est déjà le motif qui régissait la
 * péremption et la case de report ; on l'étend, on ne l'invente pas.
 *
 * ⚠ LE PÉRIMÈTRE N'EST PLUS ICI : il se demande dans `BulkSupplyScopeDialog` et
 * voyage en paramètres d'URL. La feuille est ainsi rechargeable, et le bouton
 * Retour du navigateur ramène quelque part.
 *
 * ⚠ AUCUNE RÈGLE DE SAISIE N'EST RÉÉCRITE. `lib/stock/lignes-conditionnees`
 * porte `totalSaisi`, `resumeConversion`, `rappelConditionnement` et
 * `libelleCanal` ; ils servent les transferts et les ajustements. Et la lecture
 * d'une quantité passe par `lireNombre` : ⚠ jamais `parseFloat`, où « 12 500 »
 * rend DOUZE.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/auth/permission-gate";
import { ChannelPriceBlock } from "@/components/products/channel-price-block";
import { BulkSupplyScopeDialog } from "@/components/stock/BulkSupplyScopeDialog";
import { StatStrip, StatStripItem } from "@/components/shared/StatStrip";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatPrice } from "@/lib/format";
import { blendedUnitCost } from "@/lib/pricing";
import { lireNombre, phraseDeRefus } from "@/lib/stock/nombres";
import {
  libelleCanal,
  rappelConditionnement,
  resumeConversion,
  totalSaisi,
  type SaisieQuantite,
} from "@/lib/stock/lignes-conditionnees";
import {
  avecLesNoms,
  depuisParams,
  resumePerimetre,
  versParams,
  type PerimetreAppro,
} from "@/lib/stock/perimetre-appro";
import type { Packaging } from "@vente-facile/core";
import {
  createBulkStockMovement,
  getSupplySheet,
  type BulkSupplyLine,
  type SupplySheetLine,
} from "@/actions/stock.actions";

/** Ce que le formulaire retient d'une ligne, avant tout envoi. */
interface Saisie {
  /** Les quantités restent des CHAÎNES : `lireNombre` les juge et NOMME son refus. */
  contenants: string;
  vrac: string;
  /** Les prix sont des nombres : `ChannelPriceBlock` est un champ `type="number"`. */
  coutUnite: number | null;
  coutContenant: number | null;
  prixDetail: number | null;
  prixGros: number | null;
  peremption: string;
  reporterPrix: boolean;
}

const SAISIE_VIDE: Saisie = {
  contenants: "",
  vrac: "",
  coutUnite: null,
  coutContenant: null,
  prixDetail: null,
  prixGros: null,
  peremption: "",
  reporterPrix: false,
};

/** Le conditionnement d'une ligne, au format du noyau. */
function conditionnementDe(ligne: SupplySheetLine): Packaging | null {
  if (!ligne.packaging_factor || ligne.packaging_factor < 2) return null;
  return {
    factor: ligne.packaging_factor,
    retailWord: ligne.retail_unit_label,
    packageWord: ligne.package_unit_label,
    packageOnly: ligne.selling_mode === "wholesale_only",
  };
}

function nombre(saisie: string): number | null {
  const lu = lireNombre(saisie);
  return lu.ok ? lu.valeur : null;
}

/**
 * Un prix de la fiche, prêt à pré-remplir un champ.
 *
 * ⚠ ZÉRO DEVIENT VIDE : le serveur rend « 0.00 » pour un prix jamais renseigné,
 * et l'afficher ferait lire « cet article coûte zéro » au lieu de laisser le
 * champ invitant.
 */
function prixDeLaFiche(brut: string): number | null {
  const v = parseFloat(brut);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Les quatre prix de la fiche, posés sur la ligne.
 *
 * Le marchand n'a ainsi rien à ressaisir pour un réapprovisionnement au même
 * prix, et voit sa marge dès qu'il déplie la ligne. C'est ce que `prefillPrices`
 * fait déjà dans le dialogue d'un seul mouvement.
 */
function saisieInitiale(ligne: SupplySheetLine): Saisie {
  const cond = conditionnementDe(ligne);
  return {
    ...SAISIE_VIDE,
    coutUnite: prixDeLaFiche(ligne.cost_price),
    coutContenant: cond ? prixDeLaFiche(ligne.package_cost_price) : null,
    prixDetail: prixDeLaFiche(ligne.selling_price),
    prixGros: cond ? prixDeLaFiche(ligne.wholesale_price) : null,
  };
}

export default function BulkSupplyPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const router = useRouter();
  const searchParams = useSearchParams();
  const money = useCurrency();
  // ⚠ LE JETON EST EXTRAIT AVANT TOUT RAPPEL : lire `session?.accessToken` dans
  //   un corps mémoïsé fait inférer `session` entier au compilateur React, qui
  //   refuse alors d'optimiser - et ce dépôt a déjà payé la dépendance à
  //   `session` complet, cinq effets se relançant à chaque rotation de jeton.
  const jeton = session?.accessToken;
  // `OrganizationChecker` ne rend `children` que lorsque l'organisation est
  // chargée : elle est garantie non nulle dès le premier rendu d'une page du
  // tableau de bord. Le repli ne sert qu'au typage.
  const orgId = organization?.id ?? "";

  // ⚠ L'URL EST LA SEULE SOURCE DU PÉRIMÈTRE. Le doubler d'un état React
  //   donnerait deux vérités, et c'est celle qu'on oublie de mettre à jour qui
  //   finirait affichée en en-tête.
  const cle = searchParams.toString();
  const { perimetre: brut, aucunParametre } = useMemo(
    () => depuisParams(new URLSearchParams(cle)),
    [cle]
  );

  const [modale, setModale] = useState(aucunParametre);
  const [navigue, setNavigue] = useState(false);
  const [noms, setNoms] = useState<Parameters<typeof avecLesNoms>[1]>({});
  const perimetre = useMemo(() => avecLesNoms(brut, noms), [brut, noms]);

  const [nomEntrepot, setNomEntrepot] = useState<string | null>(null);
  const [lignes, setLignes] = useState<SupplySheetLine[] | null>(null);
  const [tronquee, setTronquee] = useState(false);
  const [limite, setLimite] = useState(0);
  const [saisies, setSaisies] = useState<Record<string, Saisie>>({});
  const [erreursLigne, setErreursLigne] = useState<Record<string, string>>({});
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [prepare, setPrepare] = useState(false);
  const [envoie, setEnvoie] = useState(false);

  /** La feuille se prépare au MONTAGE, et à chaque changement d'URL. */
  useEffect(() => {
    if (!jeton || aucunParametre) {
      setLignes(null);
      return;
    }
    let vivant = true;
    const params = new URLSearchParams(cle);
    const demande = {
      warehouse: params.get("warehouse") ?? "",
      scope: brut.portee,
      categories: brut.categories.map((c) => c.value),
      products: brut.articles.map((a) => a.value),
      search: brut.recherche.trim() || undefined,
    };

    setPrepare(true);
    // ⚠ TOUT EST REMIS À PLAT : garder les saisies d'un périmètre précédent
    //   enverrait des quantités sur des articles qui ne sont plus à l'écran, et
    //   le marchand ne les verrait jamais.
    setErreursLigne({});
    setSaisies({});
    setOuvertes({});
    setNoms({});

    getSupplySheet(jeton, orgId, demande)
      .then((r) => {
        if (!vivant) return;
        if (!r.success || !r.data) {
          toast.error(r.message || "La feuille n'a pas pu être préparée");
          setLignes([]);
          return;
        }
        setLignes(r.data.lines);
        setTronquee(r.data.truncated);
        setLimite(r.data.limit);
        setNomEntrepot(r.data.warehouse_name);
        setSaisies(
          Object.fromEntries(
            r.data.lines.map((l) => [l.product, saisieInitiale(l)])
          )
        );
        // Les puces du périmètre reçoivent leur NOM : l'URL ne porte que des
        // identifiants, et une puce qu'on ne peut pas lire ne se retire pas.
        setNoms({
          categories: r.data.selection.categories.map((c) => ({
            value: c.id,
            label: c.name,
          })),
          articles: r.data.selection.products.map((p) => ({
            value: p.id,
            label: p.name,
          })),
        });
        if (r.data.lines.length === 0) toast.info("Aucun article dans ce périmètre");
      })
      .finally(() => {
        if (vivant) setPrepare(false);
      });

    return () => {
      vivant = false;
    };
    // `brut` est dérivé de `cle` : la clé suffit, et elle est primitive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton, orgId, cle, aucunParametre]);

  const majSaisie = useCallback((produit: string, patch: Partial<Saisie>) => {
    setSaisies((s) => ({ ...s, [produit]: { ...SAISIE_VIDE, ...s[produit], ...patch } }));
    setErreursLigne((e) => {
      if (!e[produit]) return e;
      const suivant = { ...e };
      delete suivant[produit];
      return suivant;
    });
  }, []);

  /** Les lignes réellement saisies, et leur verdict. */
  const retenues = useMemo(() => {
    if (!lignes) return [];
    return lignes
      .map((ligne) => {
        const s = saisies[ligne.product] ?? SAISIE_VIDE;
        const cond = conditionnementDe(ligne);
        const saisie: SaisieQuantite = {
          conditionnement: cond,
          contenants: nombre(s.contenants),
          vrac: nombre(s.vrac),
        };
        return { ligne, s, cond, saisie, total: totalSaisi(saisie) };
      })
      .filter((x) => x.total > 0);
  }, [lignes, saisies]);

  /**
   * Ce que l'envoi engage.
   *
   * ⚠ UN SEUL TOTAL, dans la devise de l'établissement : les coûts saisis y
   *   sont libellés (le catalogue n'a pas de devise), donc il n'y a rien à
   *   ventiler - et sommer des devises serait précisément ce que ce dépôt
   *   interdit partout ailleurs.
   */
  const cadran = useMemo(() => {
    let unites = 0;
    let valeur = 0;
    for (const { s, cond, saisie, total } of retenues) {
      unites += total;
      if (cond) {
        valeur +=
          (saisie.contenants ?? 0) * (s.coutContenant ?? 0) +
          (saisie.vrac ?? 0) * (s.coutUnite ?? 0);
      } else {
        valeur += total * (s.coutUnite ?? 0);
      }
    }
    return { lignes: retenues.length, unites, valeur };
  }, [retenues]);

  /**
   * Les lignes dont une quantité est ILLISIBLE.
   *
   * ┌────────────────────────────────────────────────────────────────────────┐
   * │ UNE SAISIE ILLISIBLE SE DIT, ET ELLE RETIENT L'ENVOI.                 │
   * │                                                                        │
   * │ `lireNombre` refuse le négatif et l'illisible, et la ligne affiche son │
   * │ motif sous le champ fautif. Mais une ligne refusée vaut zéro, donc     │
   * │ elle sort du corps envoyé : sans cette garde, le magasinier envoie     │
   * │ trente-neuf lignes sur quarante en croyant les avoir toutes passées,   │
   * │ et la quarantième n'entre jamais en stock. Le serveur ne peut rien y   │
   * │ faire - elle ne lui parvient pas.                                      │
   * └────────────────────────────────────────────────────────────────────────┘
   */
  const illisibles = useMemo(() => {
    if (!lignes) return [];
    return lignes.filter((ligne) => {
      const s = saisies[ligne.product] ?? SAISIE_VIDE;
      return !lireNombre(s.contenants).ok || !lireNombre(s.vrac).ok;
    });
  }, [lignes, saisies]);

  const envoyer = async () => {
    if (!jeton) return;
    const entrepot = new URLSearchParams(cle).get("warehouse") ?? "";
    if (!entrepot) return;

    setEnvoie(true);
    setErreursLigne({});
    const corps: BulkSupplyLine[] = retenues.map(({ ligne, s, cond, saisie }) => {
      const base: BulkSupplyLine = { product: ligne.product };
      if (cond) {
        if (saisie.contenants) base.package_quantity = saisie.contenants;
        if (saisie.vrac) base.loose_quantity = saisie.vrac;
        if (s.coutContenant !== null && s.coutContenant > 0) {
          base.package_unit_cost = s.coutContenant;
        }
      } else {
        base.quantity = saisie.vrac ?? 0;
      }
      if (s.coutUnite !== null && s.coutUnite > 0) base.unit_cost = s.coutUnite;
      if (s.peremption) base.expiry_date = s.peremption;
      if (s.reporterPrix) {
        base.update_product_prices = true;
        if (s.prixDetail !== null && s.prixDetail > 0) base.selling_price = s.prixDetail;
        if (s.prixGros !== null && s.prixGros > 0) base.wholesale_price = s.prixGros;
      }
      return base;
    });

    const r = await createBulkStockMovement(jeton, orgId, {
      warehouse: entrepot,
      movement_type: perimetre.type,
      notes: notes.trim() || undefined,
      lines: corps,
    });
    setEnvoie(false);

    if (r.success) {
      toast.success(r.message);
      router.push("/dashboard/stock/movements");
      return;
    }

    // ⚠ LES ERREURS S'AFFICHENT SUR LEUR LIGNE, pas dans un toast. Le serveur
    //   les indexe par position dans l'envoi : on remonte cet index jusqu'à
    //   l'article, sinon le marchand lit « Indiquez une quantité » sans savoir
    //   laquelle corriger.
    const parLigne = r.errors?.lines;
    if (parLigne && typeof parLigne === "object" && !Array.isArray(parLigne)) {
      const trouvees: Record<string, string> = {};
      const aOuvrir: Record<string, boolean> = {};
      for (const [index, detail] of Object.entries(parLigne)) {
        const cible = retenues[Number(index)];
        if (!cible) continue;
        trouvees[cible.ligne.product] = phraseDuRefus(detail);
        // ⚠ UNE LIGNE REFUSÉE S'OUVRE : son motif peut porter sur un prix ou
        //   une péremption, que le dévoilement progressif tient repliés.
        aOuvrir[cible.ligne.product] = true;
      }
      setErreursLigne(trouvees);
      setOuvertes((o) => ({ ...o, ...aOuvrir }));
      toast.error(
        `${Object.keys(trouvees).length} ligne(s) à corriger : rien n'a été enregistré.`
      );
      return;
    }
    toast.error(r.message || "La livraison n'a pas été enregistrée");
  };

  const allerVers = (p: PerimetreAppro) => {
    setNavigue(true);
    setModale(false);
    router.push(`/dashboard/stock/supplies?${versParams(p).toString()}`);
  };

  // La navigation est terminée dès que l'URL a changé.
  useEffect(() => setNavigue(false), [cle]);

  const peutEnvoyer = retenues.length > 0 && illisibles.length === 0 && !envoie;

  /** Pourquoi le bouton est fermé. Un bouton muet se lit comme une panne. */
  const motifFerme =
    illisibles.length > 0
      ? `${illisibles.length} ligne(s) portent une quantité illisible : corrigez-les, sinon elles n'entreront pas en stock.`
      : retenues.length === 0
        ? "Saisissez au moins une quantité."
        : null;

  return (
    <PermissionGate
      permission="stock_movements.create"
      fallback={
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Vous n&apos;avez pas le droit d&apos;enregistrer une entrée de stock.
          </CardContent>
        </Card>
      }
      hide={false}
    >
      <div className="space-y-6">
        {/* --- EN-TÊTE : le périmètre en toutes lettres, et comment en changer */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/stock/movements")}
              aria-label="Retour aux mouvements"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">Approvisionnement de masse</h1>
              <p className="text-sm text-muted-foreground">
                {aucunParametre
                  ? "Une livraison entière, en une seule saisie."
                  : resumePerimetre(perimetre, nomEntrepot)}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setModale(true)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Changer le périmètre
          </Button>
        </div>

        {/* ⚠ SANS AUCUN PARAMÈTRE, LA MODALE S'OUVRE D'ELLE-MÊME. Un signet ou
            un lien d'une version antérieure ne doit pas rendre une feuille vide
            sans dire pourquoi. */}
        {aucunParametre ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Dites ce que vous recevez : la feuille se remplira toute seule.
              <div className="mt-4">
                <Button onClick={() => setModale(true)}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Choisir le périmètre
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {prepare ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              Préparation de la feuille…
            </CardContent>
          </Card>
        ) : null}

        {/* --- LA FEUILLE ---------------------------------------------- */}
        {!prepare && lignes !== null ? (
          <>
            {tronquee ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Le périmètre dépasse {limite} articles : seuls les {limite} premiers
                sont affichés. Resserrez-le par catégorie ou par nom, sinon la
                livraison serait saisie à moitié sans que rien ne le dise.
              </div>
            ) : null}

            <StatStrip>
              <StatStripItem label="Lignes saisies" value={String(cadran.lignes)} />
              <StatStripItem
                label="Articles de la feuille"
                value={String(lignes.length)}
              />
              <StatStripItem
                label="Unités reçues"
                value={cadran.unites.toLocaleString("fr-FR")}
                hint="Toutes références confondues : ce sont des unités de détail différentes."
              />
              <StatStripItem
                label="Valeur d'achat"
                value={money.formatPrice(cadran.valeur)}
                hint="Dans la devise de l'établissement, comme les prix du catalogue."
              />
            </StatStrip>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Feuille d&apos;approvisionnement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-0 sm:p-6 sm:pt-0">
                {lignes.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    Aucun article dans ce périmètre. Élargissez-le, ou choisissez
                    « Tout le catalogue ».
                  </p>
                ) : (
                  lignes.map((ligne) => (
                    <LigneFeuille
                      key={ligne.product}
                      ligne={ligne}
                      saisie={saisies[ligne.product] ?? SAISIE_VIDE}
                      erreur={erreursLigne[ligne.product]}
                      ouverte={!!ouvertes[ligne.product]}
                      currencySymbol={money.currency.symbol}
                      onBasculer={() =>
                        setOuvertes((o) => ({
                          ...o,
                          [ligne.product]: !o[ligne.product],
                        }))
                      }
                      onChange={(patch) => majSaisie(ligne.product, patch)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* --- L'ENVOI ---------------------------------------------- */}
            {lignes.length > 0 ? (
              <Card>
                <CardContent className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="notes-livraison">Note de la livraison</Label>
                    <Textarea
                      id="notes-livraison"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Fournisseur, numéro de bon…"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      {/* ⚠ UN REFUS CONDAMNE TOUTE LA LIVRAISON : une moitié de
                      bon enregistrée est pire que rien, et c'est pourquoi le
                      serveur écrit tout d'un bloc. On le DIT avant l'envoi. */}
                      Tout est enregistré d&apos;un bloc : si une ligne est refusée,
                      rien n&apos;entre en stock.
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      <Button
                        onClick={envoyer}
                        disabled={!peutEnvoyer}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        {envoie ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        {retenues.length > 0
                          ? `Enregistrer ${retenues.length} entrée(s)`
                          : "Enregistrer"}
                      </Button>
                      {motifFerme ? (
                        <p className="text-xs text-muted-foreground">{motifFerme}</p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>

      {modale && (
        <BulkSupplyScopeDialog
          open
          onOpenChange={setModale}
          accessToken={jeton}
          organizationId={orgId}
          initial={aucunParametre ? undefined : perimetre}
          onSubmit={allerVers}
          pending={navigue}
        />
      )}
    </PermissionGate>
  );
}

/** Le refus du serveur, ramené à une PHRASE. */
function phraseDuRefus(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(phraseDuRefus).join(" ");
  if (detail && typeof detail === "object") {
    return Object.values(detail as Record<string, unknown>)
      .map(phraseDuRefus)
      .join(" ");
  }
  return "Ligne refusée.";
}

/**
 * Une ligne de la feuille : son rayon actuel, puis ce qu'on reçoit.
 *
 * Elle emprunte les `ChannelPriceBlock` du dialogue d'un seul mouvement : même
 * encadré par canal, mêmes mots, même marge. Ce qui change est le DÉVOILEMENT -
 * les prix se déplient quand la ligne porte une quantité, ou sur le chevron.
 */
function LigneFeuille({
  ligne,
  saisie,
  erreur,
  ouverte,
  currencySymbol,
  onBasculer,
  onChange,
}: {
  ligne: SupplySheetLine;
  saisie: Saisie;
  erreur?: string;
  ouverte: boolean;
  currencySymbol: string;
  onBasculer: () => void;
  onChange: (patch: Partial<Saisie>) => void;
}) {
  const cond = conditionnementDe(ligne);
  const s: SaisieQuantite = {
    conditionnement: cond,
    contenants: nombre(saisie.contenants),
    vrac: nombre(saisie.vrac),
  };
  const total = totalSaisi(s);
  const resume = resumeConversion(s, "recevez");
  const luContenants = lireNombre(saisie.contenants);
  const luVrac = lireNombre(saisie.vrac);

  /**
   * Produit vendu uniquement en gros : il entre et sort par contenant entier.
   * Lui proposer une saisie au détail n'aurait pas de sens, un contenant ne
   * s'ouvrant jamais pour ce mode. C'est `isPackageOnly` du dialogue.
   */
  const grosSeulement = !!cond && cond.packageOnly;

  /** Les prix se déplient dès qu'il y a quelque chose à valoriser. */
  const prixVisibles = total > 0 || ouverte;

  /**
   * Coût unitaire réellement enregistré quand les deux canaux sont servis à des
   * prix différents. C'est la seule valeur que le marchand ne peut pas
   * recalculer de tête avant de valider ; le serveur refait le calcul.
   */
  const coutMelange =
    cond &&
    (s.contenants ?? 0) > 0 &&
    (s.vrac ?? 0) > 0 &&
    saisie.coutContenant &&
    saisie.coutUnite
      ? blendedUnitCost({
          packageQuantity: s.contenants ?? 0,
          packageCost: saisie.coutContenant,
          looseQuantity: s.vrac ?? 0,
          looseCost: saisie.coutUnite,
          factor: cond.factor,
        })
      : null;

  const champQuantite = (
    canal: "retail" | "wholesale",
    valeur: string,
    lu: ReturnType<typeof lireNombre>,
    mot: string,
    onSaisir: (v: string) => void
  ) => {
    const id = `qty-${ligne.product}-${canal}`;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{libelleCanal(mot)}</Label>
        <Input
          id={id}
          inputMode="decimal"
          value={valeur}
          onChange={(e) => onSaisir(e.target.value)}
          placeholder="0"
          aria-invalid={!lu.ok}
        />
        {!lu.ok ? (
          <p className="text-sm text-red-500">{phraseDeRefus(lu.motif)}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={`space-y-3 border-b p-4 last:border-b-0 sm:rounded-lg sm:border ${
        erreur ? "border-destructive bg-destructive/5" : ""
      } ${total > 0 ? "bg-muted/30" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {/* ⚠ Le chevron ouvre une ligne SANS quantité : relire un prix ne
              doit pas obliger à saisir une quantité qu'on effacera ensuite. */}
          <button
            type="button"
            onClick={onBasculer}
            aria-expanded={prixVisibles}
            aria-label={
              prixVisibles
                ? `Replier les prix de ${ligne.name}`
                : `Afficher les prix de ${ligne.name}`
            }
            className="mt-0.5 rounded-sm text-gray-400 hover:text-gray-700"
          >
            {prixVisibles ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <div className="min-w-0">
            <p className="font-medium">{ligne.name}</p>
            <p className="text-xs text-muted-foreground">{ligne.sku}</p>
          </div>
        </div>
        <div className="text-right text-xs">
          {/* Le partage ACTUEL du rayon : c'est lui qui permet de juger ce qu'il
          faut commander. « 15 CASIERS + 10 BOUTEILLES » se lit, « 370 » non. */}
          <p className="text-muted-foreground">En rayon</p>
          <p className="font-medium">{ligne.stock_display}</p>
        </div>
      </div>

      {/* Un bloc par canal : chacun porte sa quantité, ses deux prix et sa
          marge. Le marchand lit « 2 cartons à 6 000 » d'un seul tenant, au lieu
          de rapprocher une quantité et un prix rangés dans deux zones. */}
      {!grosSeulement ? (
        <ChannelPriceBlock
          channel="retail"
          idPrefix={ligne.product}
          title={`Au détail · ${ligne.retail_unit_label}`}
          currencySymbol={currencySymbol}
          costLabel={`Prix payé par ${ligne.retail_unit_label}`}
          sellingLabel={`Prix de vente par ${ligne.retail_unit_label}`}
          costPrice={saisie.coutUnite}
          sellingPrice={saisie.prixDetail}
          onCostChange={(v) => onChange({ coutUnite: v })}
          onSellingChange={(v) => onChange({ prixDetail: v })}
          pricesVisible={prixVisibles}
          quantitySlot={champQuantite(
            "retail",
            saisie.vrac,
            luVrac,
            ligne.retail_unit_label,
            (v) => onChange({ vrac: v })
          )}
        />
      ) : null}

      {cond ? (
        <ChannelPriceBlock
          channel="wholesale"
          idPrefix={ligne.product}
          title={`En gros · ${cond.packageWord}`}
          conversionHint={rappelConditionnement(cond)}
          currencySymbol={currencySymbol}
          costLabel={`Prix payé par ${cond.packageWord}`}
          sellingLabel={`Prix de vente par ${cond.packageWord}`}
          costPrice={saisie.coutContenant}
          sellingPrice={saisie.prixGros}
          onCostChange={(v) => onChange({ coutContenant: v })}
          onSellingChange={(v) => onChange({ prixGros: v })}
          pricesVisible={prixVisibles}
          quantitySlot={champQuantite(
            "wholesale",
            saisie.contenants,
            luContenants,
            cond.packageWord,
            (v) => onChange({ contenants: v })
          )}
        />
      ) : null}

      {/* Récapitulatif de la conversion, avant validation */}
      {resume ? (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          {resume}
          {coutMelange !== null ? (
            <>
              {" "}
              Valorisées à {formatPrice(coutMelange, currencySymbol)} la{" "}
              {cond?.retailWord}.
            </>
          ) : null}
        </div>
      ) : null}

      {erreur ? <p className="text-sm font-medium text-destructive">{erreur}</p> : null}

      {total > 0 ? (
        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor={`exp-${ligne.product}`}>
              Date d&apos;expiration{" "}
              {ligne.has_expiry_date ? "*" : "(optionnel)"}
            </Label>
            <Input
              id={`exp-${ligne.product}`}
              type="date"
              className="w-auto"
              value={saisie.peremption}
              onChange={(e) => onChange({ peremption: e.target.value })}
              required={ligne.has_expiry_date}
            />
            {ligne.has_expiry_date ? (
              <p className="text-xs font-medium text-orange-600">
                ⚠️ Ce produit est périssable, la date d&apos;expiration est obligatoire
              </p>
            ) : null}
          </div>

          {/* Report des prix sur la fiche produit : jamais coché d'avance, un
              achat à prix exceptionnel ne doit pas retarifer le catalogue à
              l'insu du marchand. */}
          <PermissionGate permission="products.edit">
            <label
              htmlFor={`maj-${ligne.product}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            >
              <input
                id={`maj-${ligne.product}`}
                type="checkbox"
                checked={saisie.reporterPrix}
                onChange={(e) => onChange({ reporterPrix: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-orange-500"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">
                  Mettre à jour les prix de la fiche produit
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  Les prix de vente saisis servent au calcul de la marge. Cochez
                  pour les enregistrer aussi sur la fiche. Le coût de cette entrée
                  est enregistré dans tous les cas.
                </span>
              </span>
            </label>
          </PermissionGate>
        </div>
      ) : null}
    </div>
  );
}
