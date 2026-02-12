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
  Truck,
  PackageCheck,
  Warehouse as WarehouseIcon,
  User,
  Calendar,
  ArrowRight,
  Package,
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
  getStockTransfer,
  approveStockTransfer,
  shipStockTransfer,
  receiveStockTransfer,
  cancelStockTransfer,
  StockTransfer,
  TransferStatus,
} from "@/actions/stock.actions";

const STATUS_CONFIG: Record<
  TransferStatus,
  { label: string; color: string; icon: any }
> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  in_transit: { label: "En transit", color: "bg-blue-100 text-blue-700", icon: Truck },
  completed: { label: "Terminé", color: "bg-green-100 text-green-700", icon: CheckCircle },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function TransferDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const transferId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "ship" | "receive" | "cancel">("approve");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const transferResult = await getStockTransfer(
            session.accessToken,
            org.id,
            transferId
          );
          if (transferResult.success && transferResult.data) {
            setTransfer(transferResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching transfer details:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, transferId]);

  const openActionDialog = (type: "approve" | "ship" | "receive" | "cancel") => {
    setActionType(type);
    setShowActionDialog(true);
  };

  const handleAction = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      let result;
      switch (actionType) {
        case "approve":
          result = await approveStockTransfer(session.accessToken, organization.id, transferId);
          break;
        case "ship":
          result = await shipStockTransfer(session.accessToken, organization.id, transferId);
          break;
        case "receive":
          result = await receiveStockTransfer(session.accessToken, organization.id, transferId);
          break;
        case "cancel":
          result = await cancelStockTransfer(session.accessToken, organization.id, transferId);
          break;
      }

      if (result?.success) {
        toast.success(result.message || "Action effectuée avec succès");
        setShowActionDialog(false);
        // Refresh transfer data
        const transferResult = await getStockTransfer(
          session.accessToken,
          organization.id,
          transferId
        );
        if (transferResult.success && transferResult.data) {
          setTransfer(transferResult.data);
        }
      } else {
        toast.error(result?.message || "Erreur lors de l'action");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateOpt = (dateString?: string) => {
    if (!dateString) return "—";
    return formatDateTime(dateString);
  };


  const getActionDialogConfig = () => {
    switch (actionType) {
      case "approve":
        return {
          title: "Approuver le transfert",
          description: "Voulez-vous approuver ce transfert ? Il passera en statut 'En attente'.",
          buttonLabel: "Approuver",
          buttonClass: "bg-green-600 hover:bg-green-700",
        };
      case "ship":
        return {
          title: "Expédier le transfert",
          description:
            "Voulez-vous marquer ce transfert comme expédié ? Le stock sera déduit de l'entrepôt source.",
          buttonLabel: "Expédier",
          buttonClass: "bg-blue-600 hover:bg-blue-700",
        };
      case "receive":
        return {
          title: "Réceptionner le transfert",
          description:
            "Voulez-vous confirmer la réception ? Le stock sera ajouté à l'entrepôt de destination.",
          buttonLabel: "Confirmer la réception",
          buttonClass: "bg-green-600 hover:bg-green-700",
        };
      case "cancel":
        return {
          title: "Annuler le transfert",
          description:
            "Voulez-vous annuler ce transfert ? Si le stock a été expédié, il sera restauré dans l'entrepôt source.",
          buttonLabel: "Annuler le transfert",
          buttonClass: "bg-red-600 hover:bg-red-700",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Transfert introuvable</h1>
        </div>
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Ce transfert n'existe pas ou a été supprimé.</p>
            <Button
              onClick={() => router.push("/dashboard/stock/transfers")}
              className="mt-4"
            >
              Retour aux transferts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const items = transfer.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{transfer.reference}</h1>
              <Badge className={statusConfig.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Créé le {formatDateOpt(transfer.requested_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {transfer.status === "draft" && (
            <>
              <Button
                variant="outline"
                onClick={() => openActionDialog("approve")}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approuver
              </Button>
              <Button
                onClick={() => openActionDialog("ship")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                Expédier
              </Button>
            </>
          )}
          {transfer.status === "pending" && (
            <Button
              onClick={() => openActionDialog("ship")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Truck className="h-4 w-4 mr-2" />
              Expédier
            </Button>
          )}
          {transfer.status === "in_transit" && (
            <Button
              onClick={() => openActionDialog("receive")}
              className="bg-green-600 hover:bg-green-700"
            >
              <PackageCheck className="h-4 w-4 mr-2" />
              Réceptionner
            </Button>
          )}
          {transfer.status !== "completed" && transfer.status !== "cancelled" && (
            <Button
              variant="destructive"
              onClick={() => openActionDialog("cancel")}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Transfer Flow */}
      <Card className="p-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="text-right">
                <p className="text-sm text-gray-500">Source</p>
                <p className="font-semibold text-gray-900">
                  {transfer.source_warehouse_name}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <WarehouseIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="h-6 w-6 text-gray-400" />
              <span className="text-xs text-gray-400">
                {items.length} produit{items.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-1">
              <div className="p-3 bg-green-100 rounded-lg">
                <WarehouseIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-semibold text-gray-900">
                  {transfer.destination_warehouse_name}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info */}
        <Card className="p-0 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Informations</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div>
              <p className="text-xs text-gray-500">Demandé par</p>
              <p className="text-sm font-medium flex items-center gap-1 mt-0.5">
                <User className="h-3.5 w-3.5 text-gray-400" />
                {transfer.requested_by_name || "—"}
              </p>
            </div>
            {transfer.approved_by_name && (
              <div>
                <p className="text-xs text-gray-500">Approuvé par</p>
                <p className="text-sm font-medium flex items-center gap-1 mt-0.5">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  {transfer.approved_by_name}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Date de demande</p>
              <p className="text-sm font-medium flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                {formatDateOpt(transfer.requested_at)}
              </p>
            </div>
            {transfer.shipped_at && (
              <div>
                <p className="text-xs text-gray-500">Date d'expédition</p>
                <p className="text-sm font-medium flex items-center gap-1 mt-0.5">
                  <Truck className="h-3.5 w-3.5 text-gray-400" />
                  {formatDateOpt(transfer.shipped_at)}
                </p>
              </div>
            )}
            {transfer.received_at && (
              <div>
                <p className="text-xs text-gray-500">Date de réception</p>
                <p className="text-sm font-medium flex items-center gap-1 mt-0.5">
                  <PackageCheck className="h-3.5 w-3.5 text-gray-400" />
                  {formatDateOpt(transfer.received_at)}
                </p>
              </div>
            )}
            {transfer.notes && (
              <div>
                <p className="text-xs text-gray-500">Notes</p>
                <p className="text-sm text-gray-700 mt-0.5 bg-gray-50 p-2 rounded">
                  {transfer.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="p-0 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Articles ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun article</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2">
                        Produit
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2">
                        Demandé
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2">
                        Expédié
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2">
                        Reçu
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-gray-500">{item.product_sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-sm">
                            {parseFloat(item.quantity_requested).toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-blue-600 font-medium">
                            {item.quantity_shipped
                              ? parseFloat(item.quantity_shipped).toFixed(0)
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-green-600 font-medium">
                            {item.quantity_received
                              ? parseFloat(item.quantity_received).toFixed(0)
                              : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Timeline */}
      <Card className="p-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Progression</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            {(["draft", "pending", "in_transit", "completed"] as TransferStatus[]).map(
              (step, index) => {
                const stepConfig = STATUS_CONFIG[step];
                const StepIcon = stepConfig.icon;
                const isActive =
                  transfer.status === step ||
                  (step === "draft" &&
                    ["pending", "in_transit", "completed"].includes(transfer.status)) ||
                  (step === "pending" &&
                    ["in_transit", "completed"].includes(transfer.status)) ||
                  (step === "in_transit" && transfer.status === "completed");
                const isCurrent = transfer.status === step;
                const isCancelled = transfer.status === "cancelled";

                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`p-2 rounded-full ${isCancelled
                          ? "bg-gray-100"
                          : isCurrent
                            ? "bg-orange-100"
                            : isActive
                              ? "bg-green-100"
                              : "bg-gray-100"
                          }`}
                      >
                        <StepIcon
                          className={`h-4 w-4 ${isCancelled
                            ? "text-gray-400"
                            : isCurrent
                              ? "text-orange-600"
                              : isActive
                                ? "text-green-600"
                                : "text-gray-400"
                            }`}
                        />
                      </div>
                      <span
                        className={`text-xs mt-1 ${isCurrent ? "font-semibold text-orange-600" : "text-gray-500"
                          }`}
                      >
                        {stepConfig.label}
                      </span>
                    </div>
                    {index < 3 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 ${isActive && !isCurrent ? "bg-green-300" : "bg-gray-200"
                          }`}
                      />
                    )}
                  </div>
                );
              }
            )}
          </div>
          {transfer.status === "cancelled" && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg text-center">
              <p className="text-sm text-red-600 font-medium">Ce transfert a été annulé</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getActionDialogConfig().title}</DialogTitle>
            <DialogDescription>{getActionDialogConfig().description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAction}
              disabled={isSubmitting}
              className={getActionDialogConfig().buttonClass}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {getActionDialogConfig().buttonLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
