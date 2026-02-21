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
  ClipboardCheck,
  MoreVertical,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Warehouse as WarehouseIcon,
  Package,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDate } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getProducts, Product } from "@/actions/products.actions";
import {
  getStockAdjustments,
  createStockAdjustment,
  approveStockAdjustment,
  rejectStockAdjustment,
  getWarehouses,
  getStockByWarehouse,
  StockAdjustment,
  Warehouse,
  Stock,
  AdjustmentType,
  AdjustmentStatus,
  CreateStockAdjustmentData,
} from "@/actions/stock.actions";
import { DataPagination } from "@/components/shared/DataPagination";

const STATUS_CONFIG: Record<AdjustmentStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Approuvé", color: "bg-green-100 text-green-700", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
};

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string }[] = [
  { value: "count", label: "Inventaire" },
  { value: "damage", label: "Dommage" },
  { value: "theft", label: "Vol" },
  { value: "expired", label: "Périmé" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Autre" },
];

export default function AdjustmentsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<Stock[]>([]);
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
  const [formData, setFormData] = useState<CreateStockAdjustmentData>({
    warehouse: "",
    adjustment_type: "count",
    reason: "",
    items: [],
  });

  // Item being added
  const [newItem, setNewItem] = useState({
    product: "",
    quantity_counted: 0,
    quantity_expected: 0,
    unit_cost: 0,
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

          // Fetch adjustments
          await fetchAdjustments(org.id);
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

  // Fetch adjustments with filters
  const fetchAdjustments = useCallback(async (orgId?: string) => {
    if (!session?.accessToken) return;
    const id = orgId || organization?.id;
    if (!id) return;

    const filters: any = { page: currentPage, page_size: pageSize };
    if (selectedStatus !== "all") filters.status = selectedStatus;
    if (searchQuery) filters.search = searchQuery;

    const result = await getStockAdjustments(session.accessToken, id, filters);
    if (result.success && result.data) {
      setAdjustments(result.data.results);
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
      fetchAdjustments();
    }
  }, [organization, fetchAdjustments]);

  // Fetch warehouse stocks when warehouse changes
  useEffect(() => {
    const fetchWarehouseStocks = async () => {
      if (!session?.accessToken || !organization?.id || !formData.warehouse) return;

      const result = await getStockByWarehouse(
        session.accessToken,
        organization.id,
        formData.warehouse
      );
      if (result.success && result.data) {
        setWarehouseStocks(result.data);
      }
    };

    fetchWarehouseStocks();
  }, [formData.warehouse, session, organization]);

  // Add item to adjustment
  const addItem = () => {
    if (!newItem.product) {
      toast.error("Veuillez sélectionner un produit");
      return;
    }

    const product = products.find(p => p.id === newItem.product);
    if (!product) return;

    // Get expected quantity from warehouse stock
    const stock = warehouseStocks.find(s => s.product === newItem.product);
    const expectedQty = stock ? parseFloat(stock.quantity) : 0;

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          product: newItem.product,
          quantity_counted: newItem.quantity_counted,
          quantity_expected: expectedQty,
          unit_cost: parseFloat(product.cost_price) || 0,
        },
      ],
    });

    setNewItem({ product: "", quantity_counted: 0, quantity_expected: 0, unit_cost: 0 });
  };

  // Remove item from adjustment
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

    if (!formData.warehouse) {
      toast.error("Veuillez sélectionner un entrepôt");
      return;
    }

    if (formData.items.length === 0) {
      toast.error("Veuillez ajouter au moins un article");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createStockAdjustment(session.accessToken, organization.id, formData);
      if (result.success) {
        toast.success("Ajustement créé avec succès");
        setShowCreateDialog(false);
        fetchAdjustments();
        setFormData({
          warehouse: "",
          adjustment_type: "count",
          reason: "",
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

  // Handle adjustment actions
  const handleAction = async (adjustmentId: string, action: "approve" | "reject") => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      let result;
      if (action === "approve") {
        result = await approveStockAdjustment(session.accessToken, organization.id, adjustmentId);
      } else {
        result = await rejectStockAdjustment(session.accessToken, organization.id, adjustmentId);
      }

      if (result?.success) {
        toast.success(result.message);
        fetchAdjustments();
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
            <h1 className="text-2xl font-bold text-gray-900">Ajustements de stock</h1>
            <p className="text-sm text-gray-500 mt-1">
              Corrections et inventaires ({totalCount} au total)
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvel ajustement
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
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

      {/* Adjustments List */}
      {adjustments.length === 0 ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun ajustement</h3>
            <p className="text-sm text-gray-500 mb-4">
              Créez un ajustement pour corriger les niveaux de stock
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un ajustement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {adjustments.map(adjustment => {
            const statusConfig = STATUS_CONFIG[adjustment.status];
            const StatusIcon = statusConfig.icon;
            const typeLabel =
              ADJUSTMENT_TYPES.find(t => t.value === adjustment.adjustment_type)?.label ||
              adjustment.adjustment_type;

            return (
              <Card key={adjustment.id} className="p-0">
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
                          <h3 className="font-medium text-gray-900">{adjustment.reference}</h3>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          <Badge variant="outline">{typeLabel}</Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <WarehouseIcon className="h-4 w-4" />
                          <span>{adjustment.warehouse_name}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>{adjustment.items_count} article(s)</span>
                          <span>Créé le {formatDate(adjustment.created_at)}</span>
                          {adjustment.created_by_name && (
                            <span>Par: {adjustment.created_by_name}</span>
                          )}
                          {adjustment.total_difference && (
                            <span
                              className={
                                parseFloat(adjustment.total_difference) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              Différence: {formatPrice(adjustment.total_difference)}
                            </span>
                          )}
                        </div>

                        {adjustment.reason && (
                          <p className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                            {adjustment.reason}
                          </p>
                        )}
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
                            router.push(`/dashboard/stock/adjustments/${adjustment.id}`)
                          }
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir détails
                        </DropdownMenuItem>

                        {adjustment.status === "draft" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleAction(adjustment.id, "approve")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approuver et appliquer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAction(adjustment.id, "reject")}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Rejeter
                            </DropdownMenuItem>
                          </>
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

      {/* Create Adjustment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel ajustement de stock</DialogTitle>
            <DialogDescription>
              Corrigez les niveaux de stock après un inventaire ou une perte
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrepôt *</Label>
                <SearchableSelect
                  options={warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name }))}
                  value={formData.warehouse || undefined}
                  onValueChange={value => setFormData({ ...formData, warehouse: value, items: [] })}
                  placeholder="Sélectionner un entrepôt"
                  searchPlaceholder="Rechercher un entrepôt..."
                />
              </div>

              <div className="space-y-2">
                <Label>Type d'ajustement *</Label>
                <Select
                  value={formData.adjustment_type}
                  onValueChange={value =>
                    setFormData({ ...formData, adjustment_type: value as AdjustmentType })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Raison</Label>
              <Textarea
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Décrivez la raison de cet ajustement..."
                rows={2}
              />
            </div>

            {/* Add Items */}
            {formData.warehouse && (
              <div className="space-y-2">
                <Label>Articles à ajuster</Label>
                <div className="flex gap-2">
                  <SearchableSelect
                    options={products.map(product => {
                      const stock = warehouseStocks.find(s => s.product === product.id);
                      return { value: product.id, label: `${product.name} (Stock: ${stock ? parseFloat(stock.quantity).toFixed(0) : 0})` };
                    })}
                    value={newItem.product || undefined}
                    onValueChange={value => {
                      const stock = warehouseStocks.find(s => s.product === value);
                      setNewItem({
                        ...newItem,
                        product: value,
                        quantity_expected: stock ? parseFloat(stock.quantity) : 0,
                      });
                    }}
                    placeholder="Sélectionner un produit"
                    searchPlaceholder="Rechercher un produit..."
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Compté"
                    value={newItem.quantity_counted || ""}
                    onChange={e =>
                      setNewItem({ ...newItem, quantity_counted: parseInt(e.target.value) || 0 })
                    }
                    className="w-24"
                    min="0"
                  />
                  <Button type="button" variant="outline" onClick={addItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Items List */}
            {formData.items.length > 0 && (
              <div className="border rounded-lg divide-y">
                {formData.items.map((item, index) => {
                  const product = products.find(p => p.id === item.product);
                  const diff = item.quantity_counted - item.quantity_expected;
                  return (
                    <div key={index} className="flex items-center justify-between p-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product?.name}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span>Attendu: {item.quantity_expected}</span>
                          <span>Compté: {item.quantity_counted}</span>
                          <span
                            className={
                              diff > 0
                                ? "text-green-600 font-medium"
                                : diff < 0
                                  ? "text-red-600 font-medium"
                                  : ""
                            }
                          >
                            Diff: {diff > 0 ? "+" : ""}
                            {diff}
                          </span>
                        </div>
                      </div>
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
                  );
                })}
              </div>
            )}

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
                Créer l'ajustement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
