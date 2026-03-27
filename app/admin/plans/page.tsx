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
  AdminPlan,
  CreatePlanData,
} from "@/actions/admin.actions";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Building2,
  Package,
  Loader2,
  MoreHorizontal,
  Star,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminPlansPage() {
  const { data: session } = useSession();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreatePlanData>({
    name: "",
    code: "",
    description: "",
    price_monthly: "0",
    price_yearly: "0",
    currency: "USD",
    max_users: 1,
    max_branches: 1,
    max_products: undefined,
    max_monthly_transactions: undefined,
    storage_limit_mb: 100,
    features: {},
    is_active: true,
    is_featured: false,
    trial_days: 14,
    sort_order: 0,
  });

  useEffect(() => {
    fetchPlans();
  }, [session?.accessToken]);

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

  function resetForm() {
    setFormData({
      name: "",
      code: "",
      description: "",
      price_monthly: "0",
      price_yearly: "0",
      currency: "USD",
      max_users: 1,
      max_branches: 1,
      max_products: undefined,
      max_monthly_transactions: undefined,
      storage_limit_mb: 100,
      features: {},
      is_active: true,
      is_featured: false,
      trial_days: 14,
      sort_order: 0,
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
      currency: plan.currency,
      max_users: plan.max_users,
      max_branches: plan.max_branches,
      max_products: plan.max_products,
      max_monthly_transactions: plan.max_monthly_transactions,
      storage_limit_mb: plan.storage_limit_mb,
      features: plan.features,
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      trial_days: plan.trial_days,
      sort_order: plan.sort_order,
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

  function handleInputChange(field: keyof CreatePlanData, value: any) {
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
          <h1 className="text-2xl font-semibold">Plans d'abonnement</h1>
          <p className="text-muted-foreground">{plans.length} plan{plans.length > 1 ? "s" : ""} configuré{plans.length > 1 ? "s" : ""}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? "Modifier le plan" : "Nouveau plan"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" value={formData.code} onChange={(e) => handleInputChange("code", e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_monthly">Prix mensuel ($)</Label>
                  <Input id="price_monthly" type="number" step="0.01" value={formData.price_monthly} onChange={(e) => handleInputChange("price_monthly", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_yearly">Prix annuel ($)</Label>
                  <Input id="price_yearly" type="number" step="0.01" value={formData.price_yearly} onChange={(e) => handleInputChange("price_yearly", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Devise</Label>
                  <Input id="currency" value={formData.currency} onChange={(e) => handleInputChange("currency", e.target.value)} maxLength={3} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_users">Max utilisateurs</Label>
                  <Input id="max_users" type="number" value={formData.max_users} onChange={(e) => handleInputChange("max_users", parseInt(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_branches">Max succursales</Label>
                  <Input id="max_branches" type="number" value={formData.max_branches} onChange={(e) => handleInputChange("max_branches", parseInt(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_products">Max produits</Label>
                  <Input id="max_products" type="number" value={formData.max_products || ""} onChange={(e) => handleInputChange("max_products", e.target.value ? parseInt(e.target.value) : null)} placeholder="∞" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage_limit_mb">Stockage (MB)</Label>
                  <Input id="storage_limit_mb" type="number" value={formData.storage_limit_mb} onChange={(e) => handleInputChange("storage_limit_mb", parseInt(e.target.value))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trial_days">Jours d'essai</Label>
                  <Input id="trial_days" type="number" value={formData.trial_days} onChange={(e) => handleInputChange("trial_days", parseInt(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Ordre</Label>
                  <Input id="sort_order" type="number" value={formData.sort_order} onChange={(e) => handleInputChange("sort_order", parseInt(e.target.value))} required />
                </div>
              </div>
              <div className="flex items-center gap-6 py-2">
                <div className="flex items-center gap-2">
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => handleInputChange("is_active", checked)} />
                  <Label htmlFor="is_active">Actif</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_featured" checked={formData.is_featured} onCheckedChange={(checked) => handleInputChange("is_featured", checked)} />
                  <Label htmlFor="is_featured">Mis en avant</Label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPlan ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
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
                <span className="text-2xl font-semibold">{plan.price_monthly}$</span>
                <span className="text-muted-foreground">/mois</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.max_users} utilisateurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.max_branches} succursales</span>
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
