"use client";

/**
 * Le PÉRIMÈTRE d'un approvisionnement de masse, demandé dans une modale.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ON DEMANDE CE QU'ON REÇOIT, PUIS ON OUVRE LA FEUILLE.                   │
 * │                                                                          │
 * │ Le périmètre vivait en pleine page, au-dessus de la feuille : le         │
 * │ marchand remplissait quarante lignes avec un formulaire de réglages      │
 * │ au-dessus d'elles, et devait défiler pour le relire. Une modale pose la  │
 * │ question une fois, puis s'efface.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA NOTE DE LIVRAISON N'EST PAS ICI, et c'est voulu : on l'écrit en
 * remplissant - le numéro du bon est sur le papier qu'on a sous les yeux -
 * donc elle reste au pied de la feuille, près du bouton d'envoi.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { SearchableSelectAsync } from "@/components/ui/searchable-select-async";
import {
  createCategorySearchHandler,
  createProductSearchHandler,
  createWarehouseSearchHandler,
} from "@/lib/select-search-handlers";
import {
  aidePortee,
  motifIncomplet,
  PERIMETRE_VIDE,
  PORTEES,
  TYPES_ENTREE,
  type OptionPerimetre,
  type PerimetreAppro,
} from "@/lib/stock/perimetre-appro";
import type { MovementType, SupplyScope } from "@/actions/stock.actions";

interface BulkSupplyScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string | undefined;
  organizationId: string;
  /** Le périmètre déjà en place, quand la modale est rouverte depuis la feuille. */
  initial?: PerimetreAppro;
  /** Le marchand a validé : à l'appelant de naviguer. */
  onSubmit: (perimetre: PerimetreAppro) => void;
  /** Vrai pendant la navigation : le bouton ne doit pas pouvoir repartir. */
  pending?: boolean;
}

/**
 * ⚠ CE COMPOSANT SE MONTE CONDITIONNELLEMENT, ET CE N'EST PAS UNE OPTIMISATION.
 *
 * Chaque ouverture est alors un MONTAGE, donc un formulaire qui repart du
 * périmètre courant, sans effet de remise à zéro à tenir en phase avec les
 * champs qu'on ajoutera. C'est l'arbitrage déjà rendu pour les trois dialogues
 * des achats. Contrepartie assumée : pas d'animation de fermeture.
 *
 * Les deux appelants écrivent donc `{ouvert && <BulkSupplyScopeDialog … />}`.
 */
export function BulkSupplyScopeDialog({
  open,
  onOpenChange,
  accessToken,
  organizationId,
  initial,
  onSubmit,
  pending = false,
}: BulkSupplyScopeDialogProps) {
  const [perimetre, setPerimetre] = useState<PerimetreAppro>(
    initial ?? PERIMETRE_VIDE
  );

  const chercheEntrepot = useMemo(
    () =>
      accessToken
        ? createWarehouseSearchHandler(accessToken, organizationId)
        : async () => [],
    [accessToken, organizationId]
  );
  const chercheCategorie = useMemo(
    () =>
      accessToken
        ? createCategorySearchHandler(accessToken, organizationId)
        : async () => [],
    [accessToken, organizationId]
  );
  const chercheArticle = useMemo(
    () =>
      accessToken
        ? createProductSearchHandler(accessToken, organizationId)
        : async () => [],
    [accessToken, organizationId]
  );

  // Un seul entrepôt accessible : il est proposé d'emblée. « Un choix unique
  // n'est pas un choix », et le serveur EXIGE l'entrepôt.
  useEffect(() => {
    if (!open || perimetre.entrepot || !accessToken) return;
    let vivant = true;
    chercheEntrepot("").then((options) => {
      if (vivant && options.length === 1) {
        setPerimetre((p) =>
          p.entrepot ? p : { ...p, entrepot: options[0].value }
        );
      }
    });
    return () => {
      vivant = false;
    };
  }, [open, perimetre.entrepot, accessToken, chercheEntrepot]);

  const maj = useCallback(
    (patch: Partial<PerimetreAppro>) => setPerimetre((p) => ({ ...p, ...patch })),
    []
  );

  const motif = motifIncomplet(perimetre);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,calc(100dvh-1rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pt-6 pb-3 pr-12 text-left">
          <DialogTitle>Approvisionner en masse</DialogTitle>
          <DialogDescription>
            Dites ce que vous recevez : la feuille se remplit toute seule.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-6 pb-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Entrepôt *</Label>
              <SearchableSelectAsync
                value={perimetre.entrepot || undefined}
                onValueChange={(value) => maj({ entrepot: value })}
                onSearch={chercheEntrepot}
                placeholder="Choisir l'entrepôt"
                searchPlaceholder="Rechercher un entrepôt..."
              />
            </div>
            <div className="space-y-2">
              <Label>Type d&apos;entrée *</Label>
              <Select
                value={perimetre.type}
                onValueChange={(v) => maj({ type: v as MovementType })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_ENTREE.map((t) => (
                    <SelectItem key={t.valeur} value={t.valeur}>
                      {t.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quels articles ?</Label>
            <Select
              value={perimetre.portee}
              onValueChange={(v) => maj({ portee: v as SupplyScope })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PORTEES.map((p) => (
                  <SelectItem key={p.valeur} value={p.valeur}>
                    {p.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {aidePortee(perimetre.portee)}
            </p>
          </div>

          {perimetre.portee === "category" ? (
            <ChoixMultiple
              label="Catégories"
              valeurs={perimetre.categories}
              onChange={(categories) => maj({ categories })}
              onSearch={chercheCategorie}
              placeholder="Ajouter une catégorie"
            />
          ) : null}
          {perimetre.portee === "product" ? (
            <ChoixMultiple
              label="Articles"
              valeurs={perimetre.articles}
              onChange={(articles) => maj({ articles })}
              onSearch={chercheArticle}
              placeholder="Ajouter un article"
            />
          ) : null}

          <div className="space-y-2">
            <Label>Filtrer par nom ou code</Label>
            <Input
              value={perimetre.recherche}
              onChange={(e) => maj({ recherche: e.target.value })}
              placeholder="Optionnel"
            />
          </div>

          {motif ? (
            <p className="text-sm text-muted-foreground">{motif}</p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t bg-card px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={motif !== null || pending}
            onClick={() => onSubmit(perimetre)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Préparer la feuille
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Plusieurs valeurs, ajoutées une par une et RETIRABLES.
 *
 * Il n'existe pas de sélecteur multiple dans ce dépôt : la convention est le
 * `SearchableSelectAsync` plus des puces à croix, comme les filtres de période.
 */
function ChoixMultiple({
  label,
  valeurs,
  onChange,
  onSearch,
  placeholder,
}: {
  label: string;
  valeurs: OptionPerimetre[];
  onChange: (v: OptionPerimetre[]) => void;
  onSearch: (q: string) => Promise<OptionPerimetre[]>;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label} *</Label>
      <SearchableSelectAsync
        value={null}
        onValueChange={() => {}}
        onSelectOption={(option) => {
          if (valeurs.some((v) => v.value === option.value)) return;
          onChange([...valeurs, { value: option.value, label: option.label }]);
        }}
        onSearch={onSearch}
        placeholder={placeholder}
      />
      {valeurs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {valeurs.map((v) => (
            <Badge key={v.value} variant="secondary" className="gap-1">
              {v.label}
              <button
                type="button"
                aria-label={`Retirer ${v.label}`}
                onClick={() => onChange(valeurs.filter((x) => x.value !== v.value))}
                className="ml-1 rounded-sm hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
