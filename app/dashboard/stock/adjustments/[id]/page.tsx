"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Warehouse as WarehouseIcon,
  User,
  Calendar,
  FileText,
  Package,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getStockAdjustment,
  approveStockAdjustment,
  rejectStockAdjustment,
  StockAdjustment,
  AdjustmentStatus,
} from "@/actions/stock.actions";

const STATUS_CONFIG: Record<AdjustmentStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Approuvé", color: "bg-green-100 text-green-700", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function AdjustmentDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const adjustmentId = params.id as string;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [adjustment, setAdjustment] = useState<StockAdjustment | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Fetch adjustment details
          const adjustmentResult = await getStockAdjustment(
            session.accessToken,
            org.id,
            adjustmentId
          );
          if (adjustmentResult.success && adjustmentResult.data) {
            setAdjustment(adjustmentResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching adjustment details:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, adjustmentId]);

  // Handle approve
  const handleApprove = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      const result = await approveStockAdjustment(
        session.accessToken,
        organization.id,
        adjustmentId
      );
      if (result.success) {
        toast.success("Ajustement approuvé et appliqué");
        // Refresh data
        const adjustmentResult = await getStockAdjustment(
          session.accessToken,
          organization.id,
          adjustmentId
        );
        if (adjustmentResult.success && adjustmentResult.data) {
          setAdjustment(adjustmentResult.data);
        }
        setShowApproveDialog(false);
      } else {
        toast.error(result.message || "Erreur lors de l'approbation");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      const result = await rejectStockAdjustment(session.accessToken, organization.id, adjustmentId);
      if (result.success) {
        toast.success("Ajustement rejeté");
        // Refresh data
        const adjustmentResult = await getStockAdjustment(
          session.accessToken,
          organization.id,
          adjustmentId
        );
        if (adjustmentResult.success && adjustmentResult.data) {
          setAdjustment(adjustmentResult.data);
        }
        setShowRejectDialog(false);
      } else {
        toast.error(result.message || "Erreur lors du rejet");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!adjustment) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ajustement introuvable</h1>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Cet ajustement n'existe pas ou a été supprimé.</p>
            <Button onClick={() => router.push("/dashboard/stock/adjustments")} className="mt-4">
              Retour aux ajustements
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[adjustment.status];
  const StatusIcon = statusConfig.icon;
  const totalDiff = adjustment.total_difference ? parseFloat(adjustment.total_difference) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{adjustment.reference}</h1>
            <p className="text-sm text-gray-500 mt-1">{adjustment.adjustment_type_display}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {adjustment.status === "draft" && (
            <>
              <Button
                variant="outline"
                className="text-green-600 border-green-600 hover:bg-green-50"
                onClick={() => setShowApproveDialog(true)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approuver
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
                onClick={() => setShowRejectDialog(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeter
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${statusConfig.color}`}>
                <StatusIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Statut</p>
                <p className="text-lg font-semibold">{statusConfig.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Différence totale</p>
              <p
                className={`text-2xl font-bold ${totalDiff > 0 ? "text-green-600" : totalDiff < 0 ? "text-red-600" : "text-gray-900"
                  }`}
              >
                {totalDiff > 0 ? "+" : ""}
                {formatPrice(totalDiff)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <WarehouseIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Entrepôt</p>
                <p className="font-medium">{adjustment.warehouse_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Type d'ajustement</p>
                <p className="font-medium">{adjustment.adjustment_type_display}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Créé par</p>
                <p className="font-medium">{adjustment.created_by_name || "N/A"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Date de création</p>
                <p className="font-medium">{formatDateTime(adjustment.created_at)}</p>
              </div>
            </div>

            {adjustment.approved_by_name && (
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Approuvé par</p>
                  <p className="font-medium">{adjustment.approved_by_name}</p>
                  {adjustment.approved_at && (
                    <p className="text-xs text-gray-500">{formatDateTime(adjustment.approved_at)}</p>
                  )}
                </div>
              </div>
            )}

            {adjustment.reason && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Raison</p>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {adjustment.reason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium">Articles ajustés</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {adjustment.items_count || 0}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Différence en valeur</span>
                <span
                  className={`font-medium ${totalDiff > 0
                    ? "text-green-600"
                    : totalDiff < 0
                      ? "text-red-600"
                      : "text-gray-900"
                    }`}
                >
                  {totalDiff > 0 ? "+" : ""}
                  {formatPrice(totalDiff)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Articles ({adjustment.items?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!adjustment.items || adjustment.items.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun article</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Produit
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Attendu
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Compté
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Différence
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Coût unitaire
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Impact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adjustment.items.map((item, index) => {
                    const diff = item.quantity_difference || 0;
                    const impact = diff * item.unit_cost;
                    return (
                      <tr key={item.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{item.product_name}</p>
                            <p className="text-xs text-gray-500">{item.product_sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-600">{item.quantity_expected}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{item.quantity_counted}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {diff > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : diff < 0 ? (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            ) : null}
                            <span
                              className={`font-medium ${diff > 0
                                ? "text-green-600"
                                : diff < 0
                                  ? "text-red-600"
                                  : "text-gray-900"
                                }`}
                            >
                              {diff > 0 ? "+" : ""}
                              {diff}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm">{formatPrice(item.unit_cost)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium ${impact > 0
                              ? "text-green-600"
                              : impact < 0
                                ? "text-red-600"
                                : "text-gray-900"
                              }`}
                          >
                            {impact > 0 ? "+" : ""}
                            {formatPrice(impact)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approuver l'ajustement</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir approuver cet ajustement ? Le stock sera immédiatement mis à
              jour selon les quantités comptées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Annuler
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approuver et appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter l'ajustement</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir rejeter cet ajustement ? Aucune modification ne sera
              appliquée au stock.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
