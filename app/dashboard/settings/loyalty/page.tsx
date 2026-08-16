"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useOrganization } from "@/components/auth/organization-checker";
import {
  LoyaltyProgram,
  OrganizationCurrency,
  getLoyaltyProgram,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  toggleLoyaltyProgram,
  getOrganizationCurrencies,
} from "@/actions/settings.actions";

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
    points_calculation_type: "fixed_per_amount" as "fixed_per_amount" | "percentage",
    points_per_unit: 1,
    amount_per_unit: "1000",
    points_percentage: "1",
    point_value: "1",
    min_points_to_redeem: 100,
    points_expiry_days: 0,
    only_registered_customers: true,
  });

  const primaryCurrency = orgCurrencies.find((c) => c.is_primary);

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
        points_calculation_type: loyaltyProgram.points_calculation_type,
        points_per_unit: loyaltyProgram.points_per_unit,
        amount_per_unit: loyaltyProgram.amount_per_unit,
        points_percentage: loyaltyProgram.points_percentage,
        point_value: loyaltyProgram.point_value,
        min_points_to_redeem: loyaltyProgram.min_points_to_redeem,
        points_expiry_days: loyaltyProgram.points_expiry_days,
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

  return (
    <div className="space-y-4">
      {/* Loyalty Program Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-orange-500" />
                Programme de fidélité
              </CardTitle>
              <CardDescription>Récompensez vos clients fidèles avec des points</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {loyaltyProgram && (
                <Link href="/dashboard/settings/loyalty/rewards">
                  <Button variant="outline">
                    <Gift className="h-4 w-4 mr-2" />
                    Récompenses
                  </Button>
                </Link>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="text-sm text-orange-600 font-medium">Calcul des points</div>
                <div className="font-medium mt-1">
                  {loyaltyProgram.points_calculation_type === "fixed_per_amount"
                    ? `${loyaltyProgram.points_per_unit} pts / ${Number(
                        loyaltyProgram.amount_per_unit
                      ).toLocaleString()} ${primaryCurrency?.currency_symbol || "FC"}`
                    : `${loyaltyProgram.points_percentage}% du montant`}
                </div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-sm text-orange-600 font-medium">Valeur d&apos;un point</div>
                <div className="font-medium mt-1">
                  {Number(loyaltyProgram.point_value).toLocaleString()}{" "}
                  {primaryCurrency?.currency_symbol || "FC"}
                </div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-sm text-orange-600 font-medium">Minimum pour utiliser</div>
                <div className="font-medium mt-1">{loyaltyProgram.min_points_to_redeem} points</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-sm text-orange-600 font-medium">Expiration</div>
                <div className="font-medium mt-1">
                  {loyaltyProgram.points_expiry_days > 0
                    ? `${loyaltyProgram.points_expiry_days} jours`
                    : "Jamais"}
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
              <p>Aucun programme de fidélité configuré</p>
              <p className="text-sm">Créez un programme pour récompenser vos clients</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      {loyaltyProgram && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Comment utiliser les points de fidélité ?</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Les clients gagnent des points à chaque achat selon la configuration</li>
                  <li>Les points peuvent être utilisés comme de l&apos;argent lors des achats</li>
                  <li>
                    1 point = {Number(loyaltyProgram.point_value).toLocaleString()}{" "}
                    {primaryCurrency?.currency_symbol || "FC"}
                  </li>
                  <li>Minimum requis pour utiliser : {loyaltyProgram.min_points_to_redeem} points</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loyalty Program Dialog */}
      <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {loyaltyProgram ? "Modifier le programme de fidélité" : "Créer un programme de fidélité"}
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
              <Label>Type de calcul des points</Label>
              <Select
                value={loyaltyForm.points_calculation_type}
                onValueChange={(value: "fixed_per_amount" | "percentage") =>
                  setLoyaltyForm({ ...loyaltyForm, points_calculation_type: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_per_amount">Points fixes par montant</SelectItem>
                  <SelectItem value="percentage">Pourcentage du montant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loyaltyForm.points_calculation_type === "fixed_per_amount" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points gagnés</Label>
                  <Input
                    type="number"
                    value={loyaltyForm.points_per_unit}
                    onChange={(e) =>
                      setLoyaltyForm({ ...loyaltyForm, points_per_unit: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pour chaque montant de ({primaryCurrency?.currency_symbol || "FC"})</Label>
                  <Input
                    type="number"
                    value={loyaltyForm.amount_per_unit}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, amount_per_unit: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Pourcentage du montant converti en points (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={loyaltyForm.points_percentage}
                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, points_percentage: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valeur d&apos;un point ({primaryCurrency?.currency_symbol || "FC"})</Label>
                <Input
                  type="number"
                  step="any"
                  value={loyaltyForm.point_value}
                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, point_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum de points pour utiliser</Label>
                <Input
                  type="number"
                  value={loyaltyForm.min_points_to_redeem}
                  onChange={(e) =>
                    setLoyaltyForm({ ...loyaltyForm, min_points_to_redeem: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expiration des points (jours, 0 = jamais)</Label>
              <Input
                type="number"
                min={0}
                value={loyaltyForm.points_expiry_days}
                onChange={(e) =>
                  setLoyaltyForm({ ...loyaltyForm, points_expiry_days: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-sm text-gray-500">
                Chaque point a sa propre durée de vie, comptée depuis le jour où
                il a été gagné. Les points les plus anciens sont utilisés en
                premier, et le contrôle passe chaque nuit. Désactiver le
                programme gèle les points au lieu de les faire expirer.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Clients enregistrés uniquement</Label>
                <p className="text-sm text-gray-500">
                  Seuls les clients enregistrés peuvent accumuler des points
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
