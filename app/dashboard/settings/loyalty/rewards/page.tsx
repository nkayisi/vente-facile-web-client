"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Gift,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatPrice } from "@/lib/format";
import {
  LoyaltyProgram,
  LoyaltyReward,
  getLoyaltyProgram,
  getLoyaltyRewards,
  createLoyaltyReward,
  updateLoyaltyReward,
  deleteLoyaltyReward,
} from "@/actions/settings.actions";

type RewardType = LoyaltyReward["reward_type"];

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  discount_amount: "Remise en montant",
  discount_percentage: "Remise en pourcentage",
  free_product: "Produit offert",
  custom: "Autre",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  reward_type: "discount_amount" as RewardType,
  points_required: 100,
  discount_amount: "0",
  discount_percentage: "0",
  is_active: true,
};

export default function LoyaltyRewardsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();

  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<LoyaltyReward | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleting, setDeleting] = useState<LoyaltyReward | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const [programResult, rewardsResult] = await Promise.all([
        getLoyaltyProgram(session.accessToken, organization.id),
        getLoyaltyRewards(session.accessToken, organization.id),
      ]);
      if (programResult.success) setProgram(programResult.data ?? null);
      if (rewardsResult.success && rewardsResult.data) setRewards(rewardsResult.data);
    } catch {
      toast.error("Erreur lors du chargement des récompenses");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      points_required: program?.min_points_to_redeem || 100,
    });
    setShowDialog(true);
  };

  const openEdit = (reward: LoyaltyReward) => {
    setEditing(reward);
    setForm({
      name: reward.name,
      description: reward.description,
      reward_type: reward.reward_type,
      points_required: reward.points_required,
      discount_amount: reward.discount_amount,
      discount_percentage: reward.discount_percentage,
      is_active: reward.is_active,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!session?.accessToken || !organization) return;

    if (!form.name.trim()) {
      toast.error("Le nom de la récompense est obligatoire");
      return;
    }
    if (form.points_required <= 0) {
      toast.error("Le nombre de points requis doit être supérieur à zéro");
      return;
    }
    if (form.reward_type === "discount_amount" && parseFloat(form.discount_amount) <= 0) {
      toast.error("Indiquez le montant de la remise");
      return;
    }
    if (
      form.reward_type === "discount_percentage" &&
      (parseFloat(form.discount_percentage) <= 0 || parseFloat(form.discount_percentage) > 100)
    ) {
      toast.error("Le pourcentage doit être compris entre 1 et 100");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<LoyaltyReward> = {
        name: form.name.trim(),
        description: form.description.trim(),
        reward_type: form.reward_type,
        points_required: form.points_required,
        discount_amount: form.reward_type === "discount_amount" ? form.discount_amount : "0",
        discount_percentage:
          form.reward_type === "discount_percentage" ? form.discount_percentage : "0",
        is_active: form.is_active,
      };

      const result = editing
        ? await updateLoyaltyReward(session.accessToken, organization.id, editing.id, payload)
        : await createLoyaltyReward(session.accessToken, organization.id, payload);

      if (result.success) {
        toast.success(editing ? "Récompense modifiée" : "Récompense créée");
        setShowDialog(false);
        await load();
      } else {
        toast.error(result.message || "Erreur lors de l'enregistrement");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.accessToken || !organization || !deleting) return;
    setIsSaving(true);
    try {
      const result = await deleteLoyaltyReward(
        session.accessToken,
        organization.id,
        deleting.id
      );
      if (result.success) {
        toast.success("Récompense supprimée");
        setDeleting(null);
        await load();
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const describeReward = (reward: LoyaltyReward) => {
    switch (reward.reward_type) {
      case "discount_amount":
        return `Remise de ${formatPrice(reward.discount_amount)}`;
      case "discount_percentage":
        return `Remise de ${reward.discount_percentage} %`;
      case "free_product":
        return reward.product_name ? `Produit offert : ${reward.product_name}` : "Produit offert";
      default:
        return reward.description || "Récompense personnalisée";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings/loyalty">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Récompenses de fidélité</h1>
            <p className="text-sm text-gray-500">
              Ce que vos clients peuvent obtenir en échange de leurs points
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle récompense
        </Button>
      </div>

      {!program?.is_active && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4">
            <Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              Le programme de fidélité est inactif : les récompenses définies ici
              ne seront pas proposées tant qu&apos;il n&apos;est pas activé.{" "}
              <Link href="/dashboard/settings/loyalty" className="font-semibold underline">
                Configurer le programme
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {rewards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Gift className="h-10 w-10 text-gray-300" />
            <div>
              <p className="font-medium text-gray-900">Aucune récompense</p>
              <p className="text-sm text-gray-500">
                Créez une première récompense pour donner de la valeur aux points de vos clients.
              </p>
            </div>
            <Button variant="outline" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Créer une récompense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rewards.map((reward) => (
            <Card key={reward.id} className={reward.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{reward.name}</CardTitle>
                  <Badge variant={reward.is_active ? "default" : "secondary"}>
                    {reward.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>{describeReward(reward)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-800">
                    {reward.points_required} points
                  </span>
                </div>
                {reward.description && (
                  <p className="text-sm text-gray-500">{reward.description}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(reward)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => setDeleting(reward)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Création / modification */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier la récompense" : "Nouvelle récompense"}
            </DialogTitle>
            <DialogDescription>
              Définissez ce que le client obtient et combien de points cela coûte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Remise fidélité"
              />
            </div>

            <div className="space-y-2">
              <Label>Type de récompense</Label>
              <Select
                value={form.reward_type}
                onValueChange={(v) => setForm({ ...form, reward_type: v as RewardType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {REWARD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.reward_type === "discount_amount" && (
              <div className="space-y-2">
                <Label>Montant de la remise</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.discount_amount}
                  onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                />
              </div>
            )}

            {form.reward_type === "discount_percentage" && (
              <div className="space-y-2">
                <Label>Pourcentage de remise</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={form.discount_percentage}
                  onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Points requis</Label>
              <Input
                type="number"
                min={1}
                value={form.points_required}
                onChange={(e) =>
                  setForm({ ...form, points_required: parseInt(e.target.value, 10) || 0 })
                }
              />
              {program && (
                <p className="text-xs text-gray-500">
                  Minimum configuré sur le programme : {program.min_points_to_redeem} points
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Précisez les conditions si nécessaire"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Récompense active</Label>
                <p className="text-xs text-gray-500">
                  Une récompense inactive n&apos;est pas proposée aux clients
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suppression */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la récompense</DialogTitle>
            <DialogDescription>
              La récompense « {deleting?.name} » ne sera plus proposée. Les points
              déjà utilisés ne sont pas affectés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
