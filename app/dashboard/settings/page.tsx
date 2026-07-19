"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Store, Settings, Loader2, Save, Lock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { updateOrganization, getOrganization, Organization } from "@/actions/organization.actions";
import { useOrganization } from "@/components/auth/organization-checker";
import { usePermissions } from "@/components/auth/permissions-provider";
import {
  updateOrganizationSchema,
  UpdateOrganizationFormData,
  businessTypeLabels,
} from "@/lib/validations/organizations";
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/actions/settings.actions";

export default function GeneralSettingsPage() {
  const { data: session } = useSession();
  const { organization, refreshOrganization } = useOrganization();
  const { isAtLeastRole } = usePermissions();
  const canEditOrganization = isAtLeastRole("manager");

  // Détail complet de l'établissement (le endpoint liste ne renvoie pas
  // email/téléphone/adresse… → on lit le détail pour préremplir le formulaire).
  const [orgDetail, setOrgDetail] = useState<Organization | null>(null);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Formulaire d'édition des infos de l'établissement
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateOrganizationFormData>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "RDC",
      tax_id: "",
      rccm: "",
      id_nat: "",
    },
  });

  const loadOrgDetail = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    const res = await getOrganization(session.accessToken, organization.id);
    if (res.success && res.data) setOrgDetail(res.data);
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    loadOrgDetail();
  }, [loadOrgDetail]);

  // Pré-remplir le formulaire quand le détail est chargé
  useEffect(() => {
    if (orgDetail) {
      reset({
        name: orgDetail.name ?? "",
        email: orgDetail.email ?? "",
        phone: orgDetail.phone ?? "",
        address: orgDetail.address ?? "",
        city: orgDetail.city ?? "",
        country: orgDetail.country ?? "RDC",
        tax_id: orgDetail.tax_id ?? "",
        rccm: orgDetail.rccm ?? "",
        id_nat: orgDetail.id_nat ?? "",
      });
    }
  }, [orgDetail, reset]);

  const onSubmitOrg = async (data: UpdateOrganizationFormData) => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSavingOrg(true);
    try {
      const result = await updateOrganization(session.accessToken, organization.id, data);
      if (result.success) {
        toast.success("Informations de l'établissement mises à jour");
        // Recharge le détail complet (form) + le contexte global (nom dans la barre latérale)
        await Promise.all([loadOrgDetail(), refreshOrganization()]);
      } else {
        toast.error(result.message || "Erreur lors de la mise à jour");
      }
    } finally {
      setIsSavingOrg(false);
    }
  };

  // Paramètres généraux (reçus, notifications, affichage)
  const [settingsForm, setSettingsForm] = useState({
    receipt_header: "",
    receipt_footer: "",
    receipt_paper_width: 58,
    show_loyalty_points_on_receipt: true,
    low_stock_threshold: 10,
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    setIsLoadingSettings(true);
    try {
      const res = await getOrganizationSettings(session.accessToken, organization.id);
      if (res.success && res.data) {
        setSettingsForm({
          receipt_header: res.data.receipt_header || "",
          receipt_footer: res.data.receipt_footer || "",
          receipt_paper_width: res.data.receipt_paper_width || 58,
          show_loyalty_points_on_receipt: res.data.show_loyalty_points_on_receipt,
          low_stock_threshold: res.data.low_stock_threshold,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setIsLoadingSettings(false);
    }
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async () => {
    if (!session?.accessToken || !organization?.id) return;
    setIsSavingSettings(true);
    try {
      const result = await updateOrganizationSettings(session.accessToken, organization.id, settingsForm);
      if (result.success) {
        toast.success("Paramètres enregistrés");
      } else {
        toast.error(result.message || "Erreur");
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Informations de l'établissement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-orange-500" />
            Informations de l&apos;établissement
          </CardTitle>
          <CardDescription>
            Nom, coordonnées et identifiants légaux de votre établissement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canEditOrganization && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <Lock className="h-4 w-4" />
              Seuls les gérants et administrateurs peuvent modifier ces informations.
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmitOrg)} className="space-y-4">
            <fieldset disabled={!canEditOrganization || isSavingOrg} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l&apos;établissement *</Label>
                  <Input id="name" {...register("name")} placeholder="Ex : Boutique Chez Nelson" />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Type d&apos;activité</Label>
                  <Input
                    value={
                      orgDetail?.business_type_display ||
                      businessTypeLabels[orgDetail?.business_type ?? ""] ||
                      ""
                    }
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">Non modifiable après la création</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input id="phone" {...register("phone")} placeholder="Ex : +243 800 000 000" />
                  {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} placeholder="contact@exemple.cd" />
                  {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Textarea id="address" {...register("address")} rows={2} placeholder="Adresse complète" />
                {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input id="city" {...register("city")} placeholder="Ex : Kinshasa" />
                  {errors.city && <p className="text-sm text-red-500">{errors.city.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  <Input id="country" {...register("country")} placeholder="Ex : RDC" />
                  {errors.country && <p className="text-sm text-red-500">{errors.country.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_id">N° impôt (NIF)</Label>
                  <Input id="tax_id" {...register("tax_id")} />
                  {errors.tax_id && <p className="text-sm text-red-500">{errors.tax_id.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rccm">RCCM</Label>
                  <Input id="rccm" {...register("rccm")} />
                  {errors.rccm && <p className="text-sm text-red-500">{errors.rccm.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id_nat">ID National</Label>
                  <Input id="id_nat" {...register("id_nat")} />
                  {errors.id_nat && <p className="text-sm text-red-500">{errors.id_nat.message}</p>}
                </div>
              </div>
            </fieldset>

            {canEditOrganization && (
              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingOrg} className="bg-orange-500 hover:bg-orange-600">
                  {isSavingOrg ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Paramètres généraux */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-orange-500" />
            Paramètres généraux
          </CardTitle>
          <CardDescription>Reçus, notifications et affichage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingSettings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : (
            <>
              {/* Reçus */}
              <div className="space-y-4">
                <h3 className="font-medium text-orange-600">Reçus</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>En-tête du reçu</Label>
                    <Textarea
                      value={settingsForm.receipt_header}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receipt_header: e.target.value })}
                      placeholder="Texte affiché en haut du reçu"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pied de page du reçu</Label>
                    <Textarea
                      value={settingsForm.receipt_footer}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receipt_footer: e.target.value })}
                      placeholder="Texte affiché en bas du reçu"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Largeur du papier du ticket</Label>
                  <select
                    value={settingsForm.receipt_paper_width}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, receipt_paper_width: parseInt(e.target.value) })
                    }
                    className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value={58}>58mm (Ticket étroit)</option>
                    <option value={80}>80mm (Ticket standard)</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    Choisissez la largeur selon votre imprimante thermique
                  </p>
                </div>
              </div>

              {/* Notifications */}
              <div className="space-y-4">
                <h3 className="font-medium text-orange-600">Notifications</h3>
                <div className="space-y-2">
                  <Label>Seuil d&apos;alerte stock bas</Label>
                  <Input
                    type="number"
                    value={settingsForm.low_stock_threshold}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, low_stock_threshold: parseInt(e.target.value) || 0 })
                    }
                    className="max-w-xs"
                  />
                  <p className="text-sm text-gray-500">
                    Alerte lorsque le stock d&apos;un produit descend en dessous de ce seuil
                  </p>
                </div>
              </div>

              {/* Affichage sur les reçus */}
              <div className="space-y-4">
                <h3 className="font-medium text-orange-600">Affichage sur les reçus</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Afficher les points de fidélité sur les reçus</Label>
                    <p className="text-sm text-gray-500">
                      Affiche les points gagnés et le solde du client sur les reçus/factures
                    </p>
                  </div>
                  <Switch
                    checked={settingsForm.show_loyalty_points_on_receipt}
                    onCheckedChange={(checked) =>
                      setSettingsForm({ ...settingsForm, show_loyalty_points_on_receipt: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {isSavingSettings ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
