"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  getAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  deleteAdminPlan,
  getSettingsCurrencies,
  AdminPlan,
  CreatePlanData,
  SettingsCurrency,
} from "@/actions/admin.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Building2,
  Warehouse,
  Package,
  Loader2,
  MoreHorizontal,
  Star,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

function defaultCurrencyId(currencies: SettingsCurrency[]): string {
  const usd = currencies.find((c) => c.code === "USD");
  return usd?.id ?? currencies[0]?.id ?? "";
}

export default function AdminPlansPage() {
  const { data: session } = useSession();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currencies, setCurrencies] = useState<SettingsCurrency[]>([]);

  const [formData, setFormData] = useState<CreatePlanData>({
    name: "",
    code: "",
    description: "",
    price_monthly: "0",
    price_yearly: "0",
    currency: "",
    max_users: 1,
    max_branches: 1,
    max_warehouses: 1,
    max_products: undefined,
    max_monthly_transactions: undefined,
    storage_limit_mb: 100,
    features: {},
    is_active: true,
    is_featured: false,
    trial_days: 0,
    sort_order: 0,
    tier: 1,
  });

  async function fetchPlans() {
    if (!session?.accessToken) return;

    setIsLoading(true);
    const result = await getAdminPlans(session.accessToken);
    if (result.success && result.data) {
      setPlans(result.data);
    } else {
      toast.error(result.message || "Erreur lors du chargement");
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recharger quand le token change
  }, [session?.accessToken]);

  useEffect(() => {
    async function loadCurrencies() {
      if (!session?.accessToken) return;
      const result = await getSettingsCurrencies(session.accessToken);
      if (result.success && result.data) {
        const list = result.data;
        setCurrencies(list);
        setFormData((prev) =>
          prev.currency ? prev : { ...prev, currency: defaultCurrencyId(list) }
        );
      } else if (result.message) {
        toast.error(result.message);
      }
    }
    loadCurrencies();
  }, [session?.accessToken]);

  function resetForm() {
    setFormData({
      name: "",
      code: "",
      description: "",
      price_monthly: "0",
      price_yearly: "0",
      currency: defaultCurrencyId(currencies),
      max_users: 1,
      max_branches: 1,
      max_warehouses: 1,
      max_products: undefined,
      max_monthly_transactions: undefined,
      storage_limit_mb: 100,
      features: {},
      is_active: true,
      is_featured: false,
      trial_days: 0,
      sort_order: 0,
      tier: 1,
    });
    setEditingPlan(null);
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(plan: AdminPlan) {
    setFormData({
      name: plan.name,
      code: plan.code,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      currency: plan.currency.id,
      max_users: plan.max_users,
      max_branches: plan.max_branches,
      max_warehouses: plan.max_warehouses,
      max_products: plan.max_products,
      max_monthly_transactions: plan.max_monthly_transactions,
      storage_limit_mb: plan.storage_limit_mb,
      features: plan.features,
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      trial_days: plan.trial_days,
      sort_order: plan.sort_order,
      tier: plan.tier ?? 1,
    });
    setEditingPlan(plan);
    setIsDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;

    setIsSubmitting(true);
    let result;

    if (editingPlan) {
      result = await updateAdminPlan(session.accessToken, editingPlan.id, formData);
    } else {
      result = await createAdminPlan(session.accessToken, formData);
    }

    if (result.success) {
      toast.success(
        editingPlan
          ? "Plan mis à jour avec succès"
          : "Plan créé avec succès"
      );
      setIsDialogOpen(false);
      resetForm();
      fetchPlans();
    } else {
      toast.error(result.message || "Erreur lors de l'opération");
    }
    setIsSubmitting(false);
  }

  async function handleDelete(planId: string) {
    if (!session?.accessToken) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce plan ?")) return;

    const result = await deleteAdminPlan(session.accessToken, planId);
    if (result.success) {
      toast.success(result.message);
      fetchPlans();
    } else {
      toast.error(result.message || "Erreur lors de la suppression");
    }
  }

  function handleInputChange(
    field: keyof CreatePlanData,
    value: string | number | boolean | Record<string, unknown> | undefined | null
  ) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Plans d&apos;abonnement</h1>
          <p className="text-muted-foreground">{plans.length} plan{plans.length > 1 ? "s" : ""} configuré{plans.length > 1 ? "s" : ""}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau plan
            </Button>
          </DialogTrigger>
          <DialogContent
            showCloseButton
            className="flex max-h-[82vh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden sm:max-w-2xl"
          >
            <DialogHeader className="shrink-0 space-y-0.5 border-b border-border/60 py-3 pr-12 text-left">
              <DialogTitle className="text-base">
                {editingPlan ? "Modifier le plan" : "Nouveau plan"}
              </DialogTitle>
              <DialogDescription className="text-xs leading-snug">
                {editingPlan
                  ? "Tarifs, limites et visibilité."
                  : "Champs * obligatoires. Vide = illimité pour produits / transactions."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Identité
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs">
                        Nom *
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder="Professionnel"
                        required
                        autoComplete="off"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="code" className="text-xs">
                        Code *
                      </Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => handleInputChange("code", e.target.value)}
                        placeholder="pro"
                        required
                        className="h-8 font-mono text-sm"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={2}
                      placeholder="Résumé…"
                      className="min-h-18 resize-y text-sm"
                    />
                  </div>
                </div>

                <div className="border-t border-border/50 pt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tarifs
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="price_monthly" className="text-xs">
                        Mensuel *
                      </Label>
                      <Input
                        id="price_monthly"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price_monthly}
                        onChange={(e) => handleInputChange("price_monthly", e.target.value)}
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="price_yearly" className="text-xs">
                        Annuel *
                      </Label>
                      <Input
                        id="price_yearly"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price_yearly}
                        onChange={(e) => handleInputChange("price_yearly", e.target.value)}
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="currency" className="text-xs">
                        Devise *
                      </Label>
                      <Select
                        value={formData.currency || undefined}
                        onValueChange={(value) => handleInputChange("currency", value)}
                        disabled={currencies.length === 0}
                      >
                        <SelectTrigger id="currency" className="h-8 w-full text-sm">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="font-medium">{c.symbol}</span>
                              <span className="text-muted-foreground ml-2">{c.code}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Limites
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="max_users" className="text-xs">
                        Utilisateurs *
                      </Label>
                      <Input
                        id="max_users"
                        type="number"
                        min={1}
                        value={formData.max_users}
                        onChange={(e) =>
                          handleInputChange("max_users", parseInt(e.target.value, 10) || 1)
                        }
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="max_branches" className="text-xs">
                        Succursales *
                      </Label>
                      <Input
                        id="max_branches"
                        type="number"
                        min={1}
                        value={formData.max_branches}
                        onChange={(e) =>
                          handleInputChange("max_branches", parseInt(e.target.value, 10) || 1)
                        }
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="max_warehouses" className="text-xs">
                        Entrepôts *
                      </Label>
                      <Input
                        id="max_warehouses"
                        type="number"
                        min={1}
                        value={formData.max_warehouses}
                        onChange={(e) =>
                          handleInputChange("max_warehouses", parseInt(e.target.value, 10) || 1)
                        }
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="max_products" className="text-xs">
                        Produits
                      </Label>
                      <Input
                        id="max_products"
                        type="number"
                        min={0}
                        value={formData.max_products ?? ""}
                        onChange={(e) =>
                          handleInputChange(
                            "max_products",
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        placeholder="∞"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="max_monthly_transactions" className="text-xs">
                        Trans. / mois
                      </Label>
                      <Input
                        id="max_monthly_transactions"
                        type="number"
                        min={0}
                        value={formData.max_monthly_transactions ?? ""}
                        onChange={(e) =>
                          handleInputChange(
                            "max_monthly_transactions",
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )
                        }
                        placeholder="∞"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="storage_limit_mb" className="text-xs">
                        Stockage (Mo) *
                      </Label>
                      <Input
                        id="storage_limit_mb"
                        type="number"
                        min={1}
                        value={formData.storage_limit_mb}
                        onChange={(e) =>
                          handleInputChange(
                            "storage_limit_mb",
                            parseInt(e.target.value, 10) || 1
                          )
                        }
                        required
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sort_order" className="text-xs">
                        Ordre *
                      </Label>
                      <Input
                        id="sort_order"
                        type="number"
                        min={0}
                        value={formData.sort_order}
                        onChange={(e) =>
                          handleInputChange(
                            "sort_order",
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )
                        }
                        required
                        className="h-8 text-sm"
                        title="Plus petit = affiché en premier"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tier" className="text-xs">
                        Palier (tier) *
                      </Label>
                      <Input
                        id="tier"
                        type="number"
                        min={1}
                        value={formData.tier}
                        onChange={(e) =>
                          handleInputChange("tier", Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        required
                        className="h-8 text-sm"
                        title="Plus le palier est élevé, plus l’offre est considérée comme supérieure (upgrade / anti-downgrade)."
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                    <div className="space-y-1.5 w-full sm:w-auto sm:min-w-28">
                      <Label htmlFor="trial_days" className="text-xs">
                        Jours d&apos;essai
                      </Label>
                      <Input
                        id="trial_days"
                        type="number"
                        min={0}
                        value={formData.trial_days}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          handleInputChange(
                            "trial_days",
                            Number.isNaN(n) ? 0 : Math.max(0, n)
                          );
                        }}
                        required
                        className="h-8 text-sm"
                        title="0 = pas d’essai"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) =>
                            handleInputChange("is_active", checked)
                          }
                        />
                        <Label htmlFor="is_active" className="text-xs font-normal cursor-pointer">
                          Actif
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_featured"
                          checked={formData.is_featured}
                          onCheckedChange={(checked) =>
                            handleInputChange("is_featured", checked)
                          }
                        />
                        <Label htmlFor="is_featured" className="text-xs font-normal cursor-pointer">
                          Mis en avant
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  {editingPlan ? "Enregistrer" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className={`border ${plan.is_featured ? "border-primary" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.is_featured && <Star className="h-4 w-4 text-primary fill-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.code}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(plan)}>
                      <Edit className="mr-2 h-4 w-4" /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">{plan.description}</p>
              
              <div>
                <span className="text-2xl font-semibold">
                  {plan.price_monthly}
                  <span className="ml-1 text-xl">{plan.currency.symbol}</span>
                </span>
                <span className="text-muted-foreground">/mois</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span>Palier {plan.tier ?? 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.max_users} utilisateurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.max_branches} succursales</span>
                </div>
                <div className="flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.max_warehouses ?? plan.max_branches} entrepôts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.max_products || "∞"} produits</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <Badge variant={plan.is_active ? "default" : "secondary"} className={plan.is_active ? "bg-green-100 text-green-700" : ""}>
                  {plan.is_active ? "Actif" : "Inactif"}
                </Badge>
                <span className="text-sm text-muted-foreground">{plan.subscribers_count} abonnés</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
