"use client";

/**
 * Saisie de quantité du POS pour les produits vendus en gros et au détail.
 *
 * Principe : le sélecteur d'unité n'est pas un filtre exclusif mais un
 * sélecteur de *focus*. Chaque canal (conditionnement, détail) garde sa propre
 * valeur ; le nombre saisi prend le sens du canal actif. Le caissier tape
 * « 2 » sur Carton puis « 3 » sur Bouteille et obtient « 2 cartons +
 * 3 bouteilles » sans jamais multiplier de tête.
 *
 * Il s'ouvre sur 1 (voir `quantiteInitiale` du noyau), sélectionné pour que la
 * première touche le remplace, sauf quand 1 fermerait l'encaissement. Un scan
 * de douchette tapé dans le champ est reconnu (`lib/pos/rescan.ts`) : il
 * n'écrit jamais son code comme une quantité.
 *
 * Le composant ne calcule aucune quantité qui serait envoyée telle quelle : il
 * remonte la saisie brute (`packages`, `loose`), exactement comme
 * `PackagingService.to_base` l'attend côté serveur. Les règles de partage
 * scellé/vrac viennent de `lib/packaging`, miroir de `packaging.py`.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Minus, Package, Plus, Trash2 } from "lucide-react";

import { Product } from "@/actions/products.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { formatPrice } from "@/lib/format";
import {
  getPackaging,
  splitPackaged,
  roundQuantity,
  formatQuantity,
  MIN_QUANTITY,
  QUANTITY_DECIMALS,
  QUANTITY_INTEGER_DIGITS,
} from "@/lib/packaging";
import { formatUnitQuantity, pluralizeUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import {
  basculerCanal,
  quantiteInitiale,
  saisieDeQuantite,
  type EtatQuantite,
} from "@/lib/pos";
import {
  estLeMemeArticle,
  frapperDansLaSaisie,
  rescanAuRepos,
  type EtatRescan,
} from "@/lib/pos/rescan";

/** Saisie brute d'une ligne : conditionnements entiers + unités de détail. */
export interface PackagedSelection {
  packages: number;
  loose: number;
  /**
   * Remise de ligne en pourcentage. Renseignée seulement quand le sélecteur
   * expose le champ, c'est à dire en édition depuis le panier.
   */
  discountPercentage?: number;
  /**
   * Devise dans laquelle ce prix est annoncé au client. Absente : celle de la
   * facture, ce que toute vente a fait jusqu'ici.
   */
  priceCurrency?: string;
}

type Channel = "package" | "retail";

/**
 * Raccourcis de quantité : couvre l'écrasante majorité des ventes au comptoir.
 *
 * Le demi ouvre la rangée parce que ce produit se vend au POIDS : un commerce
 * qui pèse sa farine sert plus souvent un demi-kilo que dix.
 */
const QUICK_VALUES = [0.5, 1, 2, 3, 5, 10];

/**
 * Vrai sous 640 px, où un popover ancré devient moins confortable qu'une
 * feuille basse à portée du pouce. Part de `false` pour rester stable au
 * rendu serveur, puis se corrige au montage.
 */
function useIsCompact(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return compact;
}

export interface QuantityPickerProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Élément d'ancrage : la carte produit ou le bouton de la ligne panier. */
  children: React.ReactNode;
  /** Quantité déjà saisie, pour rouvrir une ligne existante en édition. */
  initial?: PackagedSelection;
  /**
   * Unités de détail que le stock couvre encore, `null` si le produit n'est
   * pas suivi en stock. ⚠ C'est une INFORMATION, plus une borne : l'ajout
   * n'est jamais refusé, c'est « Encaisser » qui ferme tant qu'une ligne
   * dépasse le disponible.
   */
  maxBase: number | null;
  /**
   * Unités déjà hors emballage scellé, `null` si le partage n'est pas
   * dérivable (stock multi-entrepôts). Ne jamais traiter `null` comme `0`.
   */
  looseAvailable: number | null;
  /**
   * Contenants encore scellés, seuls réellement vendables en gros. `null` si
   * le produit n'est pas suivi ou que le partage n'est pas connu.
   */
  sealedAvailable?: number | null;
  /**
   * L'article est bloqué par un inventaire en cours dans l'entrepôt de la
   * caisse : la référence de la session (chaîne vide si on l'ignore). Absent :
   * aucun verrou. Il s'ajoute quand même au panier (proforma, devis), et
   * l'écran le DIT.
   */
  lockReference?: string | null;
  /**
   * Ouvre `packages` conditionnements en stock. Fourni seulement quand le
   * caissier en a le droit ; sans lui, le sélecteur se contente d'expliquer le
   * refus. Doit résoudre une fois le stock rafraîchi.
   */
  onUnpack?: (packages: number) => Promise<void>;
  onConfirm: (selection: PackagedSelection) => void;
  submitLabel?: string;
  /**
   * Remise actuelle de la ligne. La renseigner affiche le champ de remise ;
   * l'omettre garde l'ajout au plus court.
   */
  discountPercent?: number;
  maxDiscountPercent?: number;
  /**
   * Devises dans lesquelles ce prix peut être ANNONCÉ.
   *
   * À un seul élément : aucun choix à faire, et la rangée disparaît - un
   * sélecteur à une seule entrée n'est pas un choix, c'est du bruit.
   */
  currencyCodes?: string[];
  /** Celle de la facture : le défaut, et la première de la rangée. */
  invoiceCurrency?: string;
  /** Devise déjà choisie, pour rouvrir une ligne en édition. */
  initialCurrency?: string;
  /** Retrait de la ligne, proposé quand la quantité retombe à zéro. */
  onRemove?: () => void;
  /**
   * `dialog` : toujours dans une boîte, sans carte d'ancrage.
   *
   * L'article SCANNÉ n'est pas forcément dans la grille, qui pagine par
   * cinquante : un popover n'aurait aucune carte où s'accrocher. Absent, la
   * présentation suit la largeur (popover sur un grand écran, feuille sinon).
   */
  presentation?: "auto" | "dialog";
}

export function QuantityPicker({
  product,
  open,
  onOpenChange,
  children,
  initial,
  maxBase,
  looseAvailable,
  sealedAvailable = null,
  lockReference = null,
  onUnpack,
  onConfirm,
  submitLabel = "Ajouter au panier",
  discountPercent,
  maxDiscountPercent = 50,
  currencyCodes = [],
  invoiceCurrency,
  initialCurrency,
  onRemove,
  presentation = "auto",
}: QuantityPickerProps) {
  const etroit = useIsCompact();
  const compact = presentation === "dialog" || etroit;

  const body = open ? (
    <QuantityPickerBody
      product={product}
      initial={initial}
      maxBase={maxBase}
      looseAvailable={looseAvailable}
      sealedAvailable={sealedAvailable}
      lockReference={lockReference}
      onUnpack={onUnpack}
      submitLabel={submitLabel}
      discountPercent={discountPercent}
      maxDiscountPercent={maxDiscountPercent}
      currencyCodes={currencyCodes}
      invoiceCurrency={invoiceCurrency}
      initialCurrency={initialCurrency}
      onRemove={
        onRemove
          ? () => {
              onRemove();
              onOpenChange(false);
            }
          : undefined
      }
      onConfirm={(selection) => {
        onConfirm(selection);
        onOpenChange(false);
      }}
      onCancel={() => onOpenChange(false)}
    />
  ) : null;

  if (compact) {
    return (
      <>
        {children}
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            showCloseButton={false}
            className={
              etroit
                ? "top-auto bottom-0 left-0 w-full max-w-full translate-x-0 translate-y-0 gap-0 rounded-b-none rounded-t-2xl border-b-0 p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
                : // Un article scanné sur un grand écran : une boîte centrée de
                  // la largeur du popover, pas une feuille qui traverse l'écran.
                  // ⚠ `grid-cols-1` n'est pas décoratif : `DialogContent` est une
                  //   grille SANS colonne explicite, dont la piste s'élargit sur
                  //   son contenu ; la rangée des raccourcis sortait alors de la
                  //   boîte, « Annuler » et le total rognés à droite.
                  "w-[min(20rem,calc(100vw-1.5rem))] grid-cols-1 gap-2 rounded-2xl p-3"
            }
          >
            {/* Le nom est déjà en tête du corps : un titre visible le doublerait. */}
            <DialogTitle className="sr-only">{`Quantité pour ${product.name}`}</DialogTitle>
            {etroit ? (
              <div
                aria-hidden
                className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-slate-200"
              />
            ) : null}
            {body}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={4}
        collisionPadding={12}
        // L'ancre n'est pas un `Trigger` : sans cette garde, un second clic sur
        // la carte fermerait le popover au pointerdown puis le rouvrirait au
        // click. On laisse le `onClick` de l'ancre faire seul la bascule.
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-qty-anchor]")) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Rayons concentriques : 16 de rayon moins 8 de marge intérieure donne
        // 8 pour chaque enfant direct, puis 4 pour la pastille du segment.
        className="w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl p-2 shadow-lg"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}

function QuantityPickerBody({
  product,
  initial,
  maxBase,
  looseAvailable,
  sealedAvailable,
  lockReference,
  onUnpack,
  submitLabel,
  discountPercent,
  maxDiscountPercent,
  currencyCodes = [],
  invoiceCurrency,
  initialCurrency,
  onConfirm,
  onCancel,
  onRemove,
}: {
  product: Product;
  initial?: PackagedSelection;
  maxBase: number | null;
  looseAvailable: number | null;
  sealedAvailable: number | null;
  lockReference: string | null;
  onUnpack?: (packages: number) => Promise<void>;
  submitLabel: string;
  discountPercent?: number;
  maxDiscountPercent: number;
  currencyCodes?: string[];
  invoiceCurrency?: string;
  initialCurrency?: string;
  onConfirm: (selection: PackagedSelection) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const packaging = getPackaging(product);
  const factor = packaging?.factor ?? 1;
  const dual = packaging !== null && !packaging.packageOnly;
  const groupId = useId();
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const startPackages = initial?.packages ?? 0;
  const startLoose = initial?.loose ?? 0;
  const isEditing = startPackages > 0 || startLoose > 0;
  const locked = lockReference !== null && lockReference !== undefined;

  /**
   * Ce qu'un « 1 » dans ce canal ouvrirait comme motif de fermer
   * l'encaissement. Le verrou d'inventaire, le stock qui ne couvre pas 1, les
   * contenants scellés manquants. L'ouverture d'un contenant n'en est pas un :
   * le stock est là, il s'ouvre (seul, ou d'un bouton dans cette même boîte).
   */
  const alerteSiUn = (canal: Channel): string | null => {
    if (locked) return "inventaire";
    const besoin = canal === "package" ? factor : 1;
    if (maxBase !== null && besoin > maxBase) return "stock";
    if (canal === "package" && sealedAvailable !== null && sealedAvailable < 1) return "scelles";
    return null;
  };

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ ON PROPOSE 1, SÉLECTIONNÉ : LA PREMIÈRE TOUCHE LE REMPLACE.          │
  // │                                                                      │
  // │ Le champ partait vide, de peur qu'un 1 d'avance se valide par        │
  // │ inadvertance. Il ne fait du tort que s'il ferme l'encaissement :     │
  // │ dans ce cas seul le champ reste vide, et le motif est dit d'emblée.  │
  // │ Ailleurs, un scan suivi d'Entrée ajoute l'article. La règle vit dans │
  // │ le noyau (`quantiteInitiale`), le terminal l'applique aussi.          │
  // └──────────────────────────────────────────────────────────────────────┘
  const [depart] = useState<EtatQuantite>(() =>
    quantiteInitiale({
      packaging,
      initiale: isEditing ? { packages: startPackages, loose: startLoose } : null,
      alerteSiUn,
    })
  );

  const [packages, setPackages] = useState(depart.packages);
  const [loose, setLoose] = useState(depart.loose);
  const [channel, setChannel] = useState<Channel>(depart.canal);
  const [draft, setDraft] = useState(
    saisieDeQuantite(depart.canal === "package" ? depart.packages : depart.loose)
  );
  // La proposition intacte suit le canal (`basculerCanal`) ; le motif dit
  // pourquoi rien n'est proposé. Les deux tombent à la première frappe.
  const [proposee, setProposee] = useState(depart.proposee);
  const [motifVide, setMotifVide] = useState<string | null>(depart.motifVide);
  const [avisScan, setAvisScan] = useState<string | null>(null);
  const rescan = useRef<EtatRescan<EtatQuantite>>(rescanAuRepos());
  const [unpacking, setUnpacking] = useState(false);
  const showDiscount = discountPercent !== undefined;
  const [discount, setDiscount] = useState(discountPercent ?? 0);
  const [discountDraft, setDiscountDraft] = useState(
    discountPercent ? String(discountPercent) : ""
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(id);
  }, []);

  /** La saisie devient celle du caissier : la proposition et son motif tombent. */
  const saisieTouchee = () => {
    setProposee(false);
    setMotifVide(null);
    setAvisScan(null);
  };

  const retailWord = packaging?.retailWord || product.unit_name?.trim() || "unité";
  const packageWord =
    packaging?.packageWord || product.packaging_unit_name?.trim() || "conditionnement";

  const unitPrice = parseFloat(product.selling_price || "0");
  const packagePrice = parseFloat(product.wholesale_price || "0");

  // ⚠ LE TOTAL SE QUANTISE, comme `verifierAjout` le fait dans le paquet.
  // Sans cela, `0,1 + 0,2` donne `0.30000000000000004` : `overStock` refusait
  // alors sur un stock de 0,3, et `canRemove` (`base === 0`) devenait faux sur
  // une ligne vidée au clavier.
  const base = roundQuantity(packages * factor + loose);
  // Miroir de `lineGross` : le prix d'un conditionnement n'est pas le prix
  // unitaire multiplié par son contenu, c'est tout l'intérêt du gros.
  const gross = packaging
    ? packages * packagePrice + loose * unitPrice
    : loose * unitPrice;
  const discountAmount = Math.round(((gross * discount) / 100) * 100) / 100;
  const amount = gross - discountAmount;

  const availabilityLabel = useMemo(() => {
    if (maxBase === null) return null;
    if (!packaging) {
      return formatUnitQuantity(maxBase, retailWord);
    }
    const knownLoose = looseAvailable === null ? maxBase : Math.min(looseAvailable, maxBase);
    const split = splitPackaged(maxBase, knownLoose, factor);
    const parts: string[] = [];
    if (split.packages > 0) {
      parts.push(formatUnitQuantity(split.packages, packageWord));
    }
    if (split.loose > 0 || parts.length === 0) {
      parts.push(formatUnitQuantity(split.loose, retailWord));
    }
    return parts.join(" + ");
  }, [maxBase, looseAvailable, packaging, factor, packageWord, retailWord]);

  const overStock = maxBase !== null && base > maxBase;

  // Miroir de `PackagingService.assert_sealed_available` : le gros ne se sert
  // que dans les contenants encore scellés. Sans ce garde-fou, demander
  // 3 casiers avec 2 casiers + 12 bouteilles en stock passait le contrôle local
  // (36 unités disponibles, 36 demandées) et se faisait refuser par un 400 à
  // l'encaissement, devant le client.
  const overSealed =
    packaging !== null && sealedAvailable !== null && packages > sealedAvailable;

  // Repli proposé au caissier : tout ce qui reste scellé, le manque basculé sur
  // le canal détail. C'est la seule issue réelle, les unités déjà sorties d'un
  // emballage ne peuvent pas y être remises.
  const fallbackSelection = useMemo(() => {
    if (!overSealed || sealedAvailable === null) return null;
    const missingLoose = (packages - sealedAvailable) * factor;
    const nextLoose = loose + missingLoose;
    if (maxBase !== null && roundQuantity(sealedAvailable * factor + nextLoose) > maxBase)
      return null;
    return { packages: sealedAvailable, loose: nextLoose };
  }, [overSealed, sealedAvailable, packages, loose, factor, maxBase]);

  // Refus symétrique de `PackagingService.ensure_loose_available` : sans
  // déconditionnement automatique, on ne sert au détail que le vrac déjà ouvert.
  const needsOpening =
    packaging !== null &&
    product.allow_auto_unpacking === false &&
    looseAvailable !== null &&
    loose > looseAvailable;

  // Ouverture qui aura lieu automatiquement : on l'annonce avant l'ajout plutôt
  // que de la constater après la vente. Le geste se prépare, il ne se subit pas.
  const packagesToOpen =
    packaging !== null &&
    product.allow_auto_unpacking !== false &&
    looseAvailable !== null &&
    loose > looseAvailable
      ? Math.ceil((loose - looseAvailable) / factor)
      : 0;

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ LE SEUIL EST `MIN_QUANTITY`, JAMAIS 1.                                │
  // │                                                                      │
  // │ Avec un seuil à 1, le caissier tapait 0,5 pour un demi-kilo de       │
  // │ farine, le champ l'acceptait, le récapitulatif l'affichait, et le    │
  // │ bouton « Ajouter au panier » restait GRIS. Sans un mot. Le serveur,  │
  // │ lui, accepte 0,001 depuis que les quantités se vendent au poids      │
  // │ (`SaleItem.quantity` : `DecimalField(15, 3)` et                       │
  // │ `MinValueValidator(0.001)`).                                          │
  // └──────────────────────────────────────────────────────────────────────┘
  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ LE STOCK N'EST PLUS UNE BORNE ICI, C'EST UNE INFORMATION.             │
  // │                                                                      │
  // │ Tout le catalogue s'ajoute, en toute quantité, même sans stock et    │
  // │ même sous inventaire : c'est ce qui permet de chiffrer une commande  │
  // │ et d'en sortir une proforma. « Encaisser » reste fermé tant qu'une   │
  // │ ligne dépasse le disponible (`motifsEncaissement` du noyau, la règle │
  // │ du serveur), et cet écran dit pourquoi AVANT l'ajout.                │
  // └──────────────────────────────────────────────────────────────────────┘
  const canSubmit = base >= MIN_QUANTITY;

  // Ouverture manuelle : elle ne se propose que si elle est possible, c'est à
  // dire s'il reste des contenants scellés à ouvrir. Le message renvoyait
  // jusqu'ici vers un écran qui n'existait pas.
  const packagesToOpenManually =
    needsOpening && looseAvailable !== null
      ? Math.ceil((loose - looseAvailable) / factor)
      : 0;
  const canUnpackHere =
    !!onUnpack &&
    packagesToOpenManually > 0 &&
    (sealedAvailable === null || packagesToOpenManually <= sealedAvailable);

  // La devise d'ANNONCE de cette ligne. `undefined` = elle suit la facture.
  const [priceCurrency, setPriceCurrency] = useState<string | undefined>(
    initialCurrency
  );

  const currentValue = channel === "package" ? packages : loose;

  /**
   * ⚠ `Math.floor` TRONQUAIT. Les boutons + / - restent entiers (on incrémente
   * d'une unité), mais arrondir ici effaçait une décimale saisie au clavier :
   * taper « 0,5 » puis cliquer « + » rendait 1 au lieu de 1,5.
   */
  const applyValue = (next: number) => {
    const clean = Math.max(0, roundQuantity(Number.isFinite(next) ? next : 0));
    if (channel === "package") setPackages(clean);
    else setLoose(clean);
    setDraft(saisieDeQuantite(clean));
    saisieTouchee();
  };

  /**
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │ `replace(/[^\d]/g, "")` SUPPRIMAIT LA VIRGULE À LA FRAPPE.           │
   * │                                                                      │
   * │ Taper « 0,5 » donnait « 05 », que `parseInt` lisait 5 : le caissier  │
   * │ voulait un demi-kilo et vendait cinq kilos. Et le back-office avait   │
   * │ DÉJÀ résolu le cas pour le stock, dans le même dépôt                 │
   * │ (`packaged-quantity-input.tsx` : `parseFloat(v.replace(",", "."))`   │
   * │ avec `step="any"`) - seul son POS ne l'appliquait pas.                │
   * │                                                                      │
   * │ Les bornes sont celles du serveur, et elles viennent du paquet        │
   * │ partagé : douze chiffres entiers, trois décimales.                   │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  const handleDraft = (raw: string) => {
    // Un seul séparateur, le premier rencontré ; le reste des caractères non
    // numériques tombe. On garde la VIRGULE à l'écran, c'est ce qui se tape.
    const nettoye = raw.replace(/[^\d.,]/g, "").replace(/\./g, ",");
    const [entier = "", ...reste] = nettoye.split(",");
    const borne =
      entier.slice(0, QUANTITY_INTEGER_DIGITS) +
      (reste.length ? "," + reste.join("").slice(0, QUANTITY_DECIMALS) : "");

    setDraft(borne);
    const value = roundQuantity(parseFloat(borne.replace(",", ".")) || 0);
    if (channel === "package") setPackages(value);
    else setLoose(value);
    saisieTouchee();
  };

  const etatCourant = (): EtatQuantite => ({
    canal: channel,
    packages,
    loose,
    proposee,
    motifVide,
  });

  const appliquerEtat = (e: EtatQuantite) => {
    setChannel(e.canal);
    setPackages(e.packages);
    setLoose(e.loose);
    setProposee(e.proposee);
    setMotifVide(e.motifVide);
    setDraft(saisieDeQuantite(e.canal === "package" ? e.packages : e.loose));
  };

  const switchChannel = (next: Channel) => {
    if (next === channel) return;
    // ⚠ Une proposition intacte SUIT le canal : sans cela « 1 bouteille »
    // proposée resterait sous les « 2 cartons » tapés ensuite.
    appliquerEtat(basculerCanal(etatCourant(), next, alerteSiUn));
    setAvisScan(null);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const applyDiscount = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    setDiscountDraft(digits);
    const parsed = parseInt(digits, 10);
    const value = Number.isFinite(parsed) ? parsed : 0;
    setDiscount(Math.min(maxDiscountPercent, Math.max(0, value)));
  };

  // Vider la quantité d'une ligne existante vaut retrait : c'est le geste
  // naturel quand le client renonce à l'article, plutôt qu'un bouton inactif.
  const canRemove = onRemove !== undefined && base === 0;

  const submit = () => {
    if (canRemove) {
      onRemove?.();
      return;
    }
    if (!canSubmit) return;
    onConfirm({
      packages: packaging ? packages : 0,
      loose,
      ...(showDiscount ? { discountPercentage: discount } : {}),
      ...(priceCurrency ? { priceCurrency } : {}),
    });
  };

  /**
   * Une douchette qui tape dans le champ : la saisie d'avant la rafale est
   * rétablie, le même article ajoute 1, un autre est refusé. Son Entrée ne
   * valide rien (`stopPropagation` : le conteneur soumettrait).
   */
  const surToucheDuChamp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const r = frapperDansLaSaisie(rescan.current, e.key, e.timeStamp, etatCourant());
    rescan.current = r.etat;
    if (!r.scan) return;
    e.preventDefault();
    e.stopPropagation();
    const avant = r.scan.avant;
    if (!estLeMemeArticle(r.scan.candidats, product)) {
      appliquerEtat(avant);
      setAvisScan("Un autre article a été scanné : terminez d'abord cette saisie.");
      return;
    }
    const plusUn = roundQuantity((avant.canal === "package" ? avant.packages : avant.loose) + 1);
    appliquerEtat({
      ...avant,
      packages: avant.canal === "package" ? plusUn : avant.packages,
      loose: avant.canal === "package" ? avant.loose : plusUn,
      proposee: false,
      motifVide: null,
    });
    setAvisScan(null);
    window.setTimeout(() => inputRef.current?.select(), 0);
  };

  const recap = (() => {
    const parts: string[] = [];
    if (packaging && packages > 0) {
      parts.push(formatUnitQuantity(packages, packageWord));
    }
    if (loose > 0 || parts.length === 0) {
      parts.push(formatUnitQuantity(loose, retailWord));
    }
    return parts.join(" + ");
  })();

  const spring = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", duration: 0.3, bounce: 0 } as const);

  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
        if (dual && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          switchChannel(e.key === "ArrowLeft" ? "package" : "retail");
        }
      }}
    >
      {/* En-tête : le produit et la règle de conversion, une bonne fois */}
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13px] font-semibold leading-tight text-slate-900"
            title={product.name}
          >
            {product.name}
          </p>
          {packaging ? (
            <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500">
              1 {packageWord} = {formatUnitQuantity(factor, retailWord)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-mr-1 -mt-0.5 h-7 shrink-0 px-1.5 text-[11px] text-slate-500 transition-transform hover:text-slate-900 active:scale-[0.96]"
          onClick={onCancel}
        >
          Annuler
        </Button>
      </div>

      {/* Sélecteur de canal : le nombre saisi prend le sens du segment actif */}
      {dual ? (
        <div
          role="radiogroup"
          aria-label="Unité de vente"
          className="relative grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
        >
          {(["package", "retail"] as const).map((value) => {
            const active = channel === value;
            const staged = value === "package" ? packages : loose;
            const word = value === "package" ? packageWord : retailWord;
            const price = value === "package" ? packagePrice : unitPrice;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => switchChannel(value)}
                className="relative flex h-11 items-center justify-center rounded px-1.5 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.96]"
              >
                {active ? (
                  <motion.span
                    layoutId={`${groupId}-channel`}
                    transition={spring}
                    className="absolute inset-0 rounded bg-white shadow-[0_1px_2px_rgba(15,23,42,0.10),0_1px_1px_rgba(15,23,42,0.06)]"
                  />
                ) : null}
                <span className="relative flex min-w-0 flex-col items-center leading-none">
                  <span
                    className={cn(
                      "max-w-full truncate text-[10px] font-semibold uppercase tracking-wide",
                      active ? "text-slate-900" : "text-slate-500"
                    )}
                  >
                    {word}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 text-[10px] tabular-nums",
                      active ? "text-orange-600" : "text-slate-400"
                    )}
                  >
                    {formatPrice(price)}
                  </span>
                </span>
                {!active && staged > 0 ? (
                  <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold leading-none text-white tabular-nums">
                    {formatQuantity(staged)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {packaging?.packageOnly
            ? `Vente par ${packageWord} (${formatPrice(packagePrice)})`
            : `Quantité en ${pluralizeUnit(retailWord, 2)}`}
        </p>
      )}

      {/* ┌────────────────────────────────────────────────────────────────┐
          │ LA DEVISE D'ANNONCE DE CETTE LIGNE.                            │
          │                                                                │
          │ Un marchand dont le catalogue est tenu en dollars annonce      │
          │ certains articles en francs. C'est le chiffre qu'il dira au    │
          │ client, et celui qui sortira sur le ticket.                    │
          │                                                                │
          │ La rangée ne paraît QUE s'il y a un choix à faire.             │
          └────────────────────────────────────────────────────────────────┘ */}
      {currencyCodes.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Annoncer en
          </span>
          {currencyCodes.map(code => {
            const actif = (priceCurrency ?? invoiceCurrency) === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() =>
                  setPriceCurrency(code === invoiceCurrency ? undefined : code)
                }
                aria-pressed={actif}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                  actif
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {code}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Compteur : cible 44 px minimum de chaque côté du nombre */}
      <div className="flex items-stretch gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-lg p-0 transition-transform active:scale-[0.96]"
          onClick={() => applyValue(currentValue - 1)}
          disabled={currentValue <= 0}
          aria-label="Diminuer"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          placeholder="0"
          onChange={(e) => handleDraft(e.target.value)}
          onKeyDown={surToucheDuChamp}
          aria-label={`Nombre de ${channel === "package" ? packageWord : retailWord}`}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-lg border text-center text-lg font-bold tabular-nums outline-none transition-colors",
            overStock || needsOpening
              ? "border-warning/40 bg-warning/10 text-slate-900 focus:border-warning"
              : "border-orange-200 bg-orange-50/60 text-slate-900 focus:border-orange-500"
          )}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 shrink-0 rounded-lg p-0 transition-transform active:scale-[0.96]"
          onClick={() => applyValue(currentValue + 1)}
          aria-label="Augmenter"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Raccourcis : la quantité tapée au comptoir est presque toujours là.
          ⚠ LE NOMBRE DE COLONNES SUIT LA LISTE. Le demi a porté `QUICK_VALUES`
          de cinq à six valeurs, et la grille était restée `grid-cols-5` : le
          dernier raccourci repassait seul sur une seconde rangée, au cinquième
          de la largeur. */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${QUICK_VALUES.length}, minmax(0, 1fr))` }}
      >
        {QUICK_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => applyValue(value)}
            className={cn(
              "h-8 rounded-lg text-[13px] font-semibold tabular-nums outline-none transition-[background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.96]",
              currentValue === value
                ? "bg-orange-500 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {/* ⚠ Et non `{value}` brut : le demi sortait « 0.5 », au point
                décimal anglais, dans un écran qui écrit « 1 250,5 » partout
                ailleurs. */}
            {formatQuantity(value)}
          </button>
        ))}
      </div>

      {/* Disponibilité, dans l'unité que le caissier a sous les yeux */}
      {availabilityLabel ? (
        <p className="flex items-center gap-1 text-[10px] text-slate-500">
          <Package className="h-2.5 w-2.5 shrink-0 text-slate-400" />
          <span className="truncate">Disponible : {availabilityLabel}</span>
        </p>
      ) : null}

      {locked ? (
        <p className="flex items-start gap-1 rounded-lg bg-warning/10 px-1.5 py-1 text-[10px] font-medium leading-snug text-warning">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          <span>
            Bloqué par un inventaire en cours{lockReference ? ` (${lockReference})` : ""} : il
            s&apos;ajoute au panier, mais ne s&apos;encaissera pas avant la fin de
            l&apos;inventaire.
          </span>
        </p>
      ) : null}

      {/* Rien n'est proposé : on dit pourquoi AVANT la moindre frappe. Le
          verrou a déjà son avis juste au-dessus. */}
      {motifVide && motifVide !== "inventaire" && base === 0 ? (
        <p className="flex items-start gap-1 rounded-lg bg-warning/10 px-1.5 py-1 text-[10px] font-medium leading-snug text-warning">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          <span>
            {motifVide === "scelles"
              ? `Plus aucun ${packageWord} scellé.`
              : product.track_inventory && product.stock_quantity == null
                ? "Stock inconnu pour cet article."
                : maxBase !== null && maxBase > 0
                  ? `Il ne reste que ${availabilityLabel}.`
                  : "Plus rien en stock."}{" "}
            Rien n&apos;est proposé : tapez une quantité pour l&apos;ajouter quand même,
            l&apos;encaissement restera fermé tant que le stock ne couvre pas la ligne.
          </span>
        </p>
      ) : null}

      {avisScan ? (
        <p role="status" className="flex items-start gap-1 rounded-lg bg-slate-100 px-1.5 py-1 text-[10px] font-medium leading-snug text-slate-700">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          <span>{avisScan}</span>
        </p>
      ) : null}

      {overStock || overSealed || needsOpening ? (
        <div className="space-y-1 rounded-lg bg-warning/10 px-1.5 py-1">
          <p className="flex items-start gap-1 text-[10px] font-medium leading-snug text-warning">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
            <span>
              {overStock
                ? `Il ne reste que ${availabilityLabel}.`
                : overSealed
                  ? `Il ne reste que ${formatUnitQuantity(sealedAvailable ?? 0, packageWord)} ${
                      (sealedAvailable ?? 0) > 1 ? "scellés" : "scellé"
                    }. Les ${pluralizeUnit(retailWord, 2)} déjà sorties d'un emballage ne peuvent pas y être remises.`
                  : `Aucune ${retailWord} à l'unité disponible : ouvrez un ${packageWord} pour continuer.`}{" "}
              L&apos;article s&apos;ajoute au panier, mais l&apos;encaissement restera fermé
              tant que le stock ne couvre pas la ligne.
            </span>
          </p>

          {/* Repli en un geste : le caissier n'a rien à recalculer devant le client. */}
          {fallbackSelection ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full border-warning/40 bg-white text-[11px] font-semibold text-warning hover:bg-warning/10"
              onClick={() => {
                setPackages(fallbackSelection.packages);
                setLoose(fallbackSelection.loose);
                setDraft(
                  saisieDeQuantite(
                    channel === "package" ? fallbackSelection.packages : fallbackSelection.loose
                  )
                );
                saisieTouchee();
              }}
            >
              Vendre{" "}
              {fallbackSelection.packages > 0
                ? `${formatUnitQuantity(fallbackSelection.packages, packageWord)} + `
                : ""}
              {formatUnitQuantity(fallbackSelection.loose, retailWord)}
            </Button>
          ) : null}

          {/* Débloquer sans quitter la caisse : l'ouverture est un geste de
              stock, mais il se décide au comptoir, client devant soi. */}
          {canUnpackHere ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={unpacking}
              className="h-8 w-full border-warning/40 bg-white text-[11px] font-semibold text-warning hover:bg-warning/10"
              onClick={async () => {
                if (!onUnpack) return;
                setUnpacking(true);
                try {
                  await onUnpack(packagesToOpenManually);
                } finally {
                  setUnpacking(false);
                }
              }}
            >
              {unpacking
                ? "Ouverture…"
                : `Ouvrir ${formatUnitQuantity(packagesToOpenManually, packageWord)} (${formatUnitQuantity(packagesToOpenManually * factor, retailWord)})`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Ouverture automatique annoncée AVANT l'ajout : c'est une conséquence
          du geste, pas une surprise à découvrir sur le ticket. */}
      {packagesToOpen > 0 && !overStock && !overSealed ? (
        <p className="flex items-start gap-1 rounded-lg bg-amber-50 px-1.5 py-1 text-[10px] font-medium leading-snug text-amber-700">
          <Package className="mt-px h-3 w-3 shrink-0" />
          <span>
            {formatUnitQuantity(packagesToOpen, packageWord)}{" "}
            {packagesToOpen > 1 ? "seront ouverts" : "sera ouvert"} pour servir{" "}
            {formatUnitQuantity(loose, retailWord)}.
          </span>
        </p>
      ) : null}

      {/* Remise de ligne : offerte à l'édition seulement, l'ajout reste court */}
      {showDiscount ? (
        <div className="flex items-center justify-between gap-2 border-t pt-1.5">
          <label
            htmlFor={`${groupId}-discount`}
            className="shrink-0 text-[11px] font-medium text-slate-600"
          >
            Remise
          </label>
          <div className="flex items-center gap-1.5">
            {discountAmount > 0 ? (
              <span className="text-[11px] tabular-nums text-orange-600">
                -{formatPrice(discountAmount)}
              </span>
            ) : null}
            <input
              id={`${groupId}-discount`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={discountDraft}
              placeholder="0"
              onChange={(e) => applyDiscount(e.target.value)}
              className="h-9 w-12 rounded-lg border border-slate-200 bg-white text-center text-[13px] font-semibold tabular-nums outline-none transition-colors focus:border-orange-500"
              aria-label={`Remise en pourcentage, maximum ${maxDiscountPercent}`}
            />
            <span className="text-[11px] font-medium text-slate-500">%</span>
          </div>
        </div>
      ) : null}

      {/* Récapitulatif : ce que la ligne vaudra, avant de valider */}
      <div
        className={cn(
          "flex items-baseline justify-between gap-2 pt-1.5",
          showDiscount ? "border-t border-dashed" : "border-t"
        )}
      >
        <span className="min-w-0 truncate text-[11px] font-medium text-slate-600">{recap}</span>
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900">
          {formatPrice(amount)}
        </span>
      </div>

      {canRemove ? (
        <Button
          type="button"
          onClick={submit}
          className="h-10 w-full rounded-lg bg-red-50 text-[13px] font-bold text-red-700 transition-transform hover:bg-red-100 active:scale-[0.96]"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Retirer l&apos;article
        </Button>
      ) : (
        <Button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="h-10 w-full rounded-lg bg-orange-500 text-[13px] font-bold text-white transition-transform hover:bg-orange-600 active:scale-[0.96] disabled:opacity-50"
        >
          {submitLabel}
        </Button>
      )}
    </div>
  );
}
