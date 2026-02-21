"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  ArrowLeft,
  Loader2,
  Plus,
  ArrowLeftRight,
  MoreVertical,
  Eye,
  Truck,
  PackageCheck,
  XCircle,
  CheckCircle,
  Clock,
  Filter,
  Warehouse as WarehouseIcon,
  Package,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getProducts, Product } from "@/actions/products.actions";
import {
  getStockTransfers,
  createStockTransfer,
  approveStockTransfer,
  shipStockTransfer,
  receiveStockTransfer,
  cancelStockTransfer,
  getWarehouses,
  StockTransfer,
  Warehouse,
  TransferStatus,
  CreateStockTransferData,
} from "@/actions/stock.actions";
import { DataPagination } from "@/components/shared/DataPagination";

const STATUS_CONFIG: Record<TransferStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  in_transit: { label: "En transit", color: "bg-blue-100 text-blue-700", icon: Truck },
  completed: { label: "Terminé", color: "bg-green-100 text-green-700", icon: CheckCircle },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function TransfersPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateStockTransferData>({
    source_warehouse: "",
    destination_warehouse: "",
    notes: "",
    items: [],
  });

  // Item being added
  const [newItem, setNewItem] = useState({
    product: "",
    quantity_requested: 0,
  });

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Fetch warehouses
          const warehousesResult = await getWarehouses(session.accessToken, org.id);
          if (warehousesResult.success && warehousesResult.data) {
            setWarehouses(warehousesResult.data);
          }

          // Fetch products
          const productsResult = await getProducts(session.accessToken, org.id);
          if (productsResult.success && productsResult.data) {
            setProducts(productsResult.data.results || []);
          }

          // Fetch transfers
          await fetchTransfers(org.id);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // Fetch transfers with filters
  const fetchTransfers = useCallback(async (orgId?: string) => {
    if (!session?.accessToken) return;
    const id = orgId || organization?.id;
    if (!id) return;

    const filters: any = { page: currentPage, page_size: pageSize };
    if (selectedStatus !== "all") filters.status = selectedStatus;
    if (searchQuery) filters.search = searchQuery;

    const result = await getStockTransfers(session.accessToken, id, filters);
    if (result.success && result.data) {
      setTransfers(result.data.results);
      setTotalCount(result.data.count);
      setHasNext(result.data.next !== null);
      setHasPrevious(result.data.previous !== null);
    }
  }, [session?.accessToken, organization?.id, currentPage, pageSize, selectedStatus, searchQuery]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Refetch when filters or page change
  useEffect(() => {
    if (organization) {
      fetchTransfers();
    }
  }, [organization, fetchTransfers]);

  // Add item to transfer
  const addItem = () => {
    if (!newItem.product || newItem.quantity_requested <= 0) {
      toast.error("Veuillez sélectionner un produit et une quantité valide");
      return;
    }

    const product = products.find(p => p.id === newItem.product);
    if (!product) return;

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product: newItem.product,
          quantity_requested: newItem.quantity_requested,
        },
      ],
    });

    setNewItem({ product: "", quantity_requested: 0 });
  };

  // Remove item from transfer
  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    if (!formData.source_warehouse || !formData.destination_warehouse) {
      toast.error("Veuillez sélectionner les entrepôts source et destination");
      return;
    }

    if (formData.source_warehouse === formData.destination_warehouse) {
      toast.error("Les entrepôts source et destination doivent être différents");
      return;
    }

    if (formData.items.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createStockTransfer(session.accessToken, organization.id, formData);
      if (result.success) {
        toast.success("Transfert créé avec succès");
        setShowCreateDialog(false);
        fetchTransfers();
        setFormData({
          source_warehouse: "",
          destination_warehouse: "",
          notes: "",
          items: [],
        });
      } else {
        toast.error(result.message || "Erreur lors de la création");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle transfer actions
  const handleAction = async (
    transferId: string,
    action: "approve" | "ship" | "receive" | "cancel"
  ) => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      let result;
      switch (action) {
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
        toast.success(result.message);
        fetchTransfers();
      } else {
        toast.error(result?.message || "Erreur lors de l'action");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transferts de stock</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gérez les transferts entre entrepôts ({totalCount} au total)
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau transfert
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par référence..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="max-w-max">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transfers List */}
      {transfers.length === 0 ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <ArrowLeftRight className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun transfert</h3>
            <p className="text-sm text-gray-500 mb-4">
              Créez un transfert pour déplacer des produits entre entrepôts
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un transfert
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transfers.map(transfer => {
            const statusConfig = STATUS_CONFIG[transfer.status];
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={transfer.id} className="p-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">{transfer.reference}</h3>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <WarehouseIcon className="h-4 w-4" />
                          <span>{transfer.source_warehouse_name}</span>
                          <ArrowLeftRight className="h-4 w-4 text-gray-400" />
                          <span>{transfer.destination_warehouse_name}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>{transfer.items_count} article(s)</span>
                          <span>Créé le {formatDate(transfer.requested_at)}</span>
                          {transfer.requested_by_name && (
                            <span>Par: {transfer.requested_by_name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/dashboard/stock/transfers/${transfer.id}`)
                          }
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir détails
                        </DropdownMenuItem>

                        {transfer.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => handleAction(transfer.id, "approve")}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approuver
                          </DropdownMenuItem>
                        )}

                        {(transfer.status === "draft" || transfer.status === "pending") && (
                          <DropdownMenuItem onClick={() => handleAction(transfer.id, "ship")}>
                            <Truck className="h-4 w-4 mr-2" />
                            Expédier
                          </DropdownMenuItem>
                        )}

                        {transfer.status === "in_transit" && (
                          <DropdownMenuItem
                            onClick={() => handleAction(transfer.id, "receive")}
                          >
                            <PackageCheck className="h-4 w-4 mr-2" />
                            Réceptionner
                          </DropdownMenuItem>
                        )}

                        {transfer.status !== "completed" && transfer.status !== "cancelled" && (
                          <DropdownMenuItem
                            onClick={() => handleAction(transfer.id, "cancel")}
                            className="text-red-600"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Annuler
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasNext={hasNext}
                hasPrevious={hasPrevious}
              />
            </div>
          )}
        </div>
      )}

      {/* Create Transfer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau transfert de stock</DialogTitle>
            <DialogDescription>
              Transférez des produits d'un entrepôt à un autre
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrepôt source *</Label>
                <SearchableSelect
                  options={warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name }))}
                  value={formData.source_warehouse || undefined}
                  onValueChange={value =>
                    setFormData({ ...formData, source_warehouse: value })
                  }
                  placeholder="Source"
                  searchPlaceholder="Rechercher un entrepôt..."
                />
              </div>

              <div className="space-y-2">
                <Label>Entrepôt destination *</Label>
                <SearchableSelect
                  options={warehouses
                    .filter(w => w.id !== formData.source_warehouse)
                    .map(warehouse => ({ value: warehouse.id, label: warehouse.name }))}
                  value={formData.destination_warehouse || undefined}
                  onValueChange={value =>
                    setFormData({ ...formData, destination_warehouse: value })
                  }
                  placeholder="Destination"
                  searchPlaceholder="Rechercher un entrepôt..."
                />
              </div>
            </div>

            {/* Add Items */}
            <div className="space-y-2">
              <Label>Articles à transférer</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  options={products.map(product => ({ value: product.id, label: product.name }))}
                  value={newItem.product || undefined}
                  onValueChange={value => setNewItem({ ...newItem, product: value })}
                  placeholder="Sélectionner un produit"
                  searchPlaceholder="Rechercher un produit..."
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Qté"
                  value={newItem.quantity_requested || ""}
                  onChange={e =>
                    setNewItem({ ...newItem, quantity_requested: parseInt(e.target.value) || 0 })
                  }
                  className="w-20"
                  min="1"
                />
                <Button type="button" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Items List */}
            {formData.items.length > 0 && (
              <div className="border rounded-lg divide-y">
                {formData.items.map((item, index) => {
                  const product = products.find(p => p.id === item.product);
                  return (
                    <div key={index} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium text-sm">{product?.name}</p>
                        <p className="text-xs text-gray-500">{product?.sku}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{item.quantity_requested}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes optionnelles..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || formData.items.length === 0}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer le transfert
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
