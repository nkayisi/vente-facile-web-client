"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Gift, Edit, Plus, ToggleLeft, ToggleRight, Loader2, Info } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useOrganization } from "@/components/auth/organization-checker";
import { formatPrice } from "@/lib/format";
import {
  LoyaltyProgram,
  OrganizationCurrency,
  getLoyaltyProgram,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  toggleLoyaltyProgram,
  getOrganizationCurrencies,
} from "@/actions/settings.actions";

/**
 * Le programme de fidélité : trois nombres, et une phrase qui les dit.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ IL EN DEMANDAIT HUIT, ET PERSONNE NE POUVAIT PRÉVOIR L'EFFET.           │
 * │                                                                          │
 * │ Mode de calcul, points par tranche, montant de la tranche, pourcentage,  │
 * │ valeur d'un point, minimum d'utilisation, plafond, expiration - plus un  │
 * │ second mécanisme de récompenses sur sa propre page. Il fallait croiser   │
 * │ trois champs pour savoir ce qu'un achat rapportait.                      │
 * │                                                                          │
 * │ Il en reste DEUX à régler, et un APERÇU CHIFFRÉ les explique mieux       │
 * │ qu'une phrase : « sur une facture de 10 000 FC, le client gagne 200 FC   │
 * │ et peut en régler jusqu'à 5 000 FC ». La cagnotte est de l'argent.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Facture témoin de l'aperçu : ronde, et du bon ordre de grandeur. */
const FACTURE_TEMOIN = 10000;

export default function LoyaltySettingsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();

  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showLoyaltyDialog, setShowLoyaltyDialog] = useState(false);

  const [loyaltyForm, setLoyaltyForm] = useState({
    name: "Programme de fidélité",
    earn_percent: "1",
    max_redemption_percent: "50",
    only_registered_customers: true,
  });

  const primaryCurrency = orgCurrencies.find((c) => c.is_primary);
  // Borne dure servie par le serveur : on ne la code pas en dur ici, elle vit
  // dans `LoyaltyProgram`. Repli à 70 tant qu'aucun programme n'est chargé.
  const redemptionCeiling = Number(
    loyaltyProgram?.max_redemption_percent_ceiling ?? 70,
  );

  const loadData = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    setIsLoading(true);
    try {
      const [loyaltyRes, orgCurrenciesRes] = await Promise.all([
        getLoyaltyProgram(session.accessToken, organization.id),
        getOrganizationCurrencies(session.accessToken, organization.id),
      ]);
      if (loyaltyRes.success) setLoyaltyProgram(loyaltyRes.data || null);
      if (orgCurrenciesRes.success && orgCurrenciesRes.data) {
        setOrgCurrencies(Array.isArray(orgCurrenciesRes.data) ? orgCurrenciesRes.data : []);
      }
    } catch (error) {
      console.error("Error loading loyalty settings:", error);
      toast.error("Erreur lors du chargement du programme de fidélité");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openLoyaltyDialog = () => {
    if (loyaltyProgram) {
      setLoyaltyForm({
        name: loyaltyProgram.name,
        earn_percent: loyaltyProgram.earn_percent,
        max_redemption_percent: loyaltyProgram.max_redemption_percent,
        only_registered_customers: loyaltyProgram.only_registered_customers,
      });
    }
    setShowLoyaltyDialog(true);
  };

  const handleSaveLoyaltyProgram = async () => {
    if (!session?.accessToken || !organization?.id) return;
    setIsSaving(true);
    try {
      const result = loyaltyProgram
        ? await updateLoyaltyProgram(session.accessToken, organization.id, loyaltyProgram.id, loyaltyForm)
        : await createLoyaltyProgram(session.accessToken, organization.id, loyaltyForm);

      if (result.success) {
        toast.success("Programme de fidélité enregistré");
        setShowLoyaltyDialog(false);
        loadData();
      } else {
        toast.error(result.message || "Erreur");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLoyalty = async () => {
    if (!session?.accessToken || !organization?.id || !loyaltyProgram) return;
    const result = await toggleLoyaltyProgram(session.accessToken, organization.id, loyaltyProgram.id);
    if (result.success && result.data) {
      toast.success(result.data.message);
      loadData();
    } else {
      toast.error(result.message || "Erreur");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // L'aperçu que le dialogue affiche sous les deux champs. Calculé sur les
  // valeurs du FORMULAIRE, pas sur le programme enregistré : le marchand doit
  // voir l'effet de ce qu'il tape, avant d'enregistrer.
  const gainTemoin = (FACTURE_TEMOIN * (Number(loyaltyForm.earn_percent) || 0)) / 100;
  const reglableTemoin =
    (FACTURE_TEMOIN *
      Math.min(Number(loyaltyForm.max_redemption_percent) || 0, redemptionCeiling)) /
    100;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-orange-500" />
                Cagnotte de fidélité
              </CardTitle>
              <CardDescription>
                Une part de chaque facture revient au client, en argent
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {loyaltyProgram && (
                <Button
                  variant={loyaltyProgram.is_active ? "outline" : "default"}
                  onClick={handleToggleLoyalty}
                  className={
                    loyaltyProgram.is_active
                      ? "border-orange-500 text-orange-600 hover:bg-orange-50"
                      : "bg-orange-500 hover:bg-orange-600"
                  }
                >
                  {loyaltyProgram.is_active ? (
                    <>
                      <ToggleRight className="h-4 w-4 mr-2" />
                      Désactiver
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4 mr-2" />
                      Activer
                    </>
                  )}
                </Button>
              )}
              <Button onClick={openLoyaltyDialog} className="bg-orange-500 hover:bg-orange-600">
                {loyaltyProgram ? (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loyaltyProgram ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-sm text-orange-600 font-medium">Statut</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={loyaltyProgram.is_active ? "default" : "secondary"}
                    className={loyaltyProgram.is_active ? "bg-orange-500" : ""}
                  >
                    {loyaltyProgram.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-sm text-orange-600 font-medium">Le client récupère</div>
                <div className="font-medium mt-1">
                  {Number(loyaltyProgram.earn_percent)} % de chaque facture
                </div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-sm text-orange-600 font-medium">
                  Part réglable avec la cagnotte
                </div>
                <div className="font-medium mt-1">
                  {Number(loyaltyProgram.max_redemption_percent)} % de la facture
                </div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-sm text-orange-600 font-medium">Éligibilité</div>
                <div className="font-medium mt-1">
                  {loyaltyProgram.only_registered_customers
                    ? "Clients enregistrés uniquement"
                    : "Tous les clients"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Gift className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Aucune cagnotte de fidélité configurée</p>
              <p className="text-sm">
                Créez un programme pour rendre une part de chaque facture à vos clients
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ce que le marchand doit pouvoir expliquer à son client, en trois lignes. */}
      {loyaltyProgram && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Comment la cagnotte fonctionne</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>
                    Sur une facture de {formatPrice(FACTURE_TEMOIN)} réglée, le client
                    récupère{" "}
                    {formatPrice(
                      (FACTURE_TEMOIN * Number(loyaltyProgram.earn_percent)) / 100,
                    )}{" "}
                    dans sa cagnotte.
                  </li>
                  <li>
                    Il peut la dépenser sur n&apos;importe quelle facture, comme de
                    l&apos;argent.
                  </li>
                  <li>
                    Au plus {Number(loyaltyProgram.max_redemption_percent)} % d&apos;une
                    facture : le client règle toujours le reste en monnaie.
                  </li>
                  <li>
                    Une vente à crédit ne crédite rien avant d&apos;être soldée.
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {loyaltyProgram ? "Modifier la cagnotte de fidélité" : "Créer une cagnotte de fidélité"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du programme</Label>
              <Input
                value={loyaltyForm.name}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Part de la facture reversée au client (%)</Label>
              <Input
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                value={loyaltyForm.earn_percent}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, earn_percent: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Part maximale d&apos;une facture réglable avec la cagnotte (%)</Label>
              <Input
                type="number"
                min={1}
                max={redemptionCeiling}
                step="any"
                value={loyaltyForm.max_redemption_percent}
                onChange={(e) =>
                  setLoyaltyForm({ ...loyaltyForm, max_redemption_percent: e.target.value })
                }
              />
              <p className="text-sm text-gray-500">
                La cagnotte ne solde jamais toute une facture : au delà de cette
                part, le client règle le reste en monnaie. Maximum{" "}
                {redemptionCeiling} %.
              </p>
            </div>

            {/* ⚠ UN APERÇU CHIFFRÉ VAUT MIEUX QU'UNE EXPLICATION. Deux
                pourcentages ne disent rien tant qu'on ne les voit pas posés sur
                une facture ; c'est cet encart qui remplace les six champs
                retirés. */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
              <p className="font-medium text-orange-800">
                Sur une facture de {formatPrice(FACTURE_TEMOIN)}
                {primaryCurrency ? "" : ""} :
              </p>
              <ul className="mt-1 space-y-0.5 text-orange-700">
                <li>le client gagne {formatPrice(gainTemoin)} dans sa cagnotte ;</li>
                <li>il peut en régler jusqu&apos;à {formatPrice(reglableTemoin)}.</li>
              </ul>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Clients enregistrés uniquement</Label>
                <p className="text-sm text-gray-500">
                  Seuls les clients enregistrés peuvent accumuler une cagnotte
                </p>
              </div>
              <Switch
                checked={loyaltyForm.only_registered_customers}
                onCheckedChange={(checked) =>
                  setLoyaltyForm({ ...loyaltyForm, only_registered_customers: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoyaltyDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveLoyaltyProgram}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
