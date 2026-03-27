"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAdminSubscription,
  extendSubscription,
  cancelSubscription,
  AdminSubscription,
} from "@/actions/admin.actions";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Calendar,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminSubscriptionDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [sub, setSub] = useState<AdminSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(30);

  const subId = params.id as string;

  useEffect(() => {
    fetchSubscription();
  }, [session?.accessToken, subId]);

  async function fetchSubscription() {
    if (!session?.accessToken || !subId) return;
    setIsLoading(true);
    const result = await getAdminSubscription(session.accessToken, subId);
    if (result.success && result.data) {
      setSub(result.data);
    } else {
      toast.error(result.message || "Abonnement introuvable");
    }
    setIsLoading(false);
  }

  async function handleExtend() {
    if (!session?.accessToken || !subId) return;
    setIsActionLoading(true);
    const result = await extendSubscription(session.accessToken, subId, extendDays);
    if (result.success) {
      toast.success(result.message);
      setExtendDialogOpen(false);
      fetchSubscription();
    } else {
      toast.error(result.message || "Erreur");
    }
    setIsActionLoading(false);
  }

  async function handleCancel() {
    if (!session?.accessToken || !subId) return;
    if (!confirm("Êtes-vous sûr de vouloir annuler cet abonnement ?")) return;
    setIsActionLoading(true);
    const result = await cancelSubscription(session.accessToken, subId);
    if (result.success) {
      toast.success(result.message);
      fetchSubscription();
    } else {
      toast.error(result.message || "Erreur");
    }
    setIsActionLoading(false);
  }

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-700",
      trial: "bg-blue-100 text-blue-700",
      past_due: "bg-amber-100 text-amber-700",
      expired: "bg-red-100 text-red-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return styles[status] || "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="text-muted-foreground text-center py-12">Abonnement introuvable.</p>
      </div>
    );
  }

  const canExtend = sub.status === "active";
  const canCancel = ["active", "trial", "past_due"].includes(sub.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Abonnement — {sub.plan_name}</h1>
            <p className="text-muted-foreground">{sub.organization_name}</p>
          </div>
        </div>
        <Badge className={getStatusStyle(sub.status)}>{sub.status_display}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Organization */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Établissement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nom</span>
              <Link
                href={`/admin/organizations/${sub.organization}`}
                className="font-medium hover:text-primary transition-colors"
              >
                {sub.organization_name}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ID</span>
              <span className="text-xs text-muted-foreground font-mono">{sub.organization.slice(0, 12)}...</span>
            </div>
          </CardContent>
        </Card>

        {/* Plan & pricing */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Plan & Tarification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{sub.plan_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cycle</span>
              <Badge variant="outline">{sub.billing_cycle_display}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prix</span>
              <span className="font-medium">{parseFloat(sub.price).toLocaleString()} {sub.currency}</span>
            </div>
          </CardContent>
        </Card>

        {/* Period */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Période
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Début</span>
              <span>{new Date(sub.current_period_start).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fin</span>
              <span>{new Date(sub.current_period_end).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Jours restants</span>
              <span className={`flex items-center gap-1.5 font-medium ${
                sub.days_remaining <= 0 ? "text-red-600" : sub.days_remaining <= 5 ? "text-amber-600" : "text-green-600"
              }`}>
                <Clock className="h-3.5 w-3.5" />
                {sub.days_remaining > 0 ? `${sub.days_remaining} jours` : "Expiré"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Créé le</span>
              <span>{new Date(sub.created_at).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {(canExtend || canCancel) && (
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            {canExtend && (
              <Button
                variant="outline"
                onClick={() => { setExtendDays(30); setExtendDialogOpen(true); }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Prolonger
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isActionLoading}
                className="text-destructive hover:text-destructive"
              >
                <X className="mr-2 h-4 w-4" />
                Annuler l'abonnement
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extend Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prolonger l'abonnement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{sub.organization_name}</p>
              <p className="text-muted-foreground">
                {sub.plan_name} — expire le {new Date(sub.current_period_end).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extendDays">Jours à ajouter</Label>
              <Input id="extendDays" type="number" min="1" max="365" value={extendDays} onChange={(e) => setExtendDays(parseInt(e.target.value))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleExtend} disabled={isActionLoading}>
                {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Prolonger
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
