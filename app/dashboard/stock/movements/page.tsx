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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  ArrowLeft,
  Loader2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Warehouse as WarehouseIcon,
  Calendar,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getProducts, Product } from "@/actions/products.actions";
import {
  getStockMovements,
  createStockMovement,
  getWarehouses,
  StockMovement,
  Warehouse,
  MovementType,
  CreateStockMovementData,
} from "@/actions/stock.actions";
import { DataPagination } from "@/components/shared/DataPagination";

const MOVEMENT_TYPES: { value: MovementType; label: string; direction: "in" | "out" }[] = [
  { value: "purchase", label: "Achat", direction: "in" },
  { value: "sale", label: "Vente", direction: "out" },
  { value: "return_in", label: "Retour client", direction: "in" },
  { value: "return_out", label: "Retour fournisseur", direction: "out" },
  { value: "transfer_in", label: "Transfert entrant", direction: "in" },
  { value: "transfer_out", label: "Transfert sortant", direction: "out" },
  { value: "adjustment_in", label: "Ajustement positif", direction: "in" },
  { value: "adjustment_out", label: "Ajustement négatif", direction: "out" },
  { value: "damage", label: "Dommage/Perte", direction: "out" },
  { value: "expired", label: "Périmé", direction: "out" },
  { value: "initial", label: "Stock initial", direction: "in" },
];

export default function MovementsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

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
  const [formData, setFormData] = useState<CreateStockMovementData>({
    product: "",
    warehouse: "",
    movement_type: "initial",
    quantity: 0,
    unit_cost: 0,
    notes: "",
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

          // Fetch movements
          await fetchMovements(org.id);
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

  // Fetch movements with filters
  const fetchMovements = useCallback(async (orgId?: string) => {
    if (!session?.accessToken) return;
    const id = orgId || organization?.id;
    if (!id) return;

    const filters: any = { page: currentPage, page_size: pageSize };
    if (selectedWarehouse !== "all") filters.warehouse = selectedWarehouse;
    if (selectedType !== "all") filters.movement_type = selectedType;
    if (searchQuery) filters.search = searchQuery;

    const result = await getStockMovements(session.accessToken, id, filters);
    if (result.success && result.data) {
      setMovements(result.data.results);
      setTotalCount(result.data.count);
      setHasNext(result.data.next !== null);
      setHasPrevious(result.data.previous !== null);
    }
  }, [session, organization, currentPage, pageSize, selectedWarehouse, selectedType, searchQuery]);

  // Refetch when filters or page change
  useEffect(() => {
    if (organization) {
      fetchMovements();
    }
  }, [organization, fetchMovements]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    if (!formData.product || !formData.warehouse) {
      toast.error("Veuillez sélectionner un produit et un entrepôt");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createStockMovement(session.accessToken, organization.id, formData);
      if (result.success) {
        toast.success("Mouvement créé avec succès");
        setShowCreateDialog(false);
        fetchMovements();
        setFormData({
          product: "",
          warehouse: "",
          movement_type: "initial",
          quantity: 0,
          unit_cost: 0,
          notes: "",
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

  // Get movement badge color
  const getMovementBadge = (type: MovementType) => {
    const movement = MOVEMENT_TYPES.find(m => m.value === type);
    if (!movement) return { color: "bg-gray-100 text-gray-700", icon: Package };

    if (movement.direction === "in") {
      return { color: "bg-green-100 text-green-700", icon: ArrowDownLeft };
    }
    return { color: "bg-red-100 text-red-700", icon: ArrowUpRight };
  };

  // Format date


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
            <h1 className="text-2xl font-bold text-gray-900">Mouvements de stock</h1>
            <p className="text-sm text-gray-500 mt-1">
              Historique de tous les mouvements ({totalCount} au total)
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouveau mouvement
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-4">
          <SearchableSelect
            options={[
              { value: "all", label: "Tous les entrepôts" },
              ...warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name })),
            ]}
            value={selectedWarehouse}
            onValueChange={setSelectedWarehouse}
            placeholder="Entrepôt"
            searchPlaceholder="Rechercher un entrepôt..."
            className="max-w-max"
          />

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="max-w-max">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {MOVEMENT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Movements List */}
      {movements.length === 0 ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun mouvement</h3>
            <p className="text-sm text-gray-500 mb-4">
              Les mouvements de stock apparaîtront ici
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer un mouvement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {movements.map(movement => {
            const badge = getMovementBadge(movement.movement_type);
            const Icon = badge.icon;
            const qty = parseFloat(movement.quantity);

            return (
              <Card key={movement.id} className="p-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${badge.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {movement.product_name}
                        </h3>
                        <Badge className={badge.color}>{movement.movement_type_display}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <WarehouseIcon className="h-3 w-3" />
                          {movement.warehouse_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(movement.created_at)}
                        </span>
                        {movement.created_by_name && (
                          <span>Par: {movement.created_by_name}</span>
                        )}
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${qty > 0 ? "text-green-600" : "text-red-600"
                          }`}
                      >
                        {qty > 0 ? "+" : ""}
                        {qty.toFixed(0)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {parseFloat(movement.quantity_before).toFixed(0)} →{" "}
                        {parseFloat(movement.quantity_after).toFixed(0)}
                      </p>
                    </div>
                  </div>

                  {movement.notes && (
                    <p className="mt-3 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                      {movement.notes}
                    </p>
                  )}
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

      {/* Create Movement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau mouvement de stock</DialogTitle>
            <DialogDescription>
              Créez un mouvement manuel pour ajuster le stock
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product">Produit *</Label>
              <SearchableSelect
                options={products.map(product => ({ value: product.id, label: `${product.name} (${product.sku})` }))}
                value={formData.product || undefined}
                onValueChange={value => setFormData({ ...formData, product: value })}
                placeholder="Sélectionner un produit"
                searchPlaceholder="Rechercher un produit..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse">Entrepôt *</Label>
              <SearchableSelect
                options={warehouses.map(warehouse => ({ value: warehouse.id, label: warehouse.name }))}
                value={formData.warehouse || undefined}
                onValueChange={value => setFormData({ ...formData, warehouse: value })}
                placeholder="Sélectionner un entrepôt"
                searchPlaceholder="Rechercher un entrepôt..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="movement_type">Type de mouvement *</Label>
              <Select
                value={formData.movement_type}
                onValueChange={value =>
                  setFormData({ ...formData, movement_type: value as MovementType })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantité *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_cost">Coût unitaire</Label>
                <Input
                  id="unit_cost"
                  type="number"
                  value={formData.unit_cost}
                  onChange={e => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="any"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
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
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
