"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Warehouse as WarehouseIcon,
  Package,
  ArrowLeftRight,
  ClipboardList,
  AlertTriangle,
  TrendingDown,
  Plus,
  Search,
  MoreVertical,
  MapPin,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  PackageCheck,
  PackageX,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getLowStock,
  getExpiringBatches,
  getStockMovements,
  getStocks,
  Warehouse,
  Stock,
  StockBatch,
  StockMovement,
  CreateWarehouseData,
} from "@/actions/stock.actions";

export default function StockPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Stock[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<StockBatch[]>([]);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateWarehouseData>({
    name: "",
    code: "",
    address: "",
    is_default: false,
    is_active: true,
    allow_negative_stock: false,
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

          const [warehousesResult, stocksResult, lowStockResult, expiringResult, movementsResult] =
            await Promise.all([
              getWarehouses(session.accessToken, org.id),
              getStocks(session.accessToken, org.id),
              getLowStock(session.accessToken, org.id),
              getExpiringBatches(session.accessToken, org.id, 30),
              getStockMovements(session.accessToken, org.id, { page_size: 10 }),
            ]);

          if (warehousesResult.success && warehousesResult.data) {
            setWarehouses(warehousesResult.data);
          }
          if (stocksResult.success && stocksResult.data) {
            setStocks(stocksResult.data);
          }
          if (lowStockResult.success && lowStockResult.data) {
            setLowStockItems(lowStockResult.data);
          }
          if (expiringResult.success && expiringResult.data) {
            setExpiringBatches(expiringResult.data);
          }
          if (movementsResult.success && movementsResult.data) {
            setRecentMovements(movementsResult.data.results || []);
          }
        }
      } catch (error) {
        console.error("Error fetching stock data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    setIsSubmitting(true);

    try {
      if (selectedWarehouse) {
        const result = await updateWarehouse(
          session.accessToken,
          organization.id,
          selectedWarehouse.id,
          formData
        );
        if (result.success) {
          toast.success("Entrepôt mis à jour avec succès");
          setWarehouses(prev =>
            prev.map(w => (w.id === selectedWarehouse.id ? { ...w, ...formData } : w))
          );
          setShowWarehouseDialog(false);
        } else {
          toast.error(result.message || "Erreur lors de la mise à jour");
        }
      } else {
        const result = await createWarehouse(session.accessToken, organization.id, formData);
        if (result.success && result.data) {
          toast.success("Entrepôt créé avec succès");
          setWarehouses(prev => [...prev, result.data!]);
          setShowWarehouseDialog(false);
        } else {
          toast.error(result.message || "Erreur lors de la création");
        }
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!session?.accessToken || !organization?.id || !selectedWarehouse) return;

    setIsSubmitting(true);

    try {
      const result = await deleteWarehouse(
        session.accessToken,
        organization.id,
        selectedWarehouse.id
      );
      if (result.success) {
        toast.success("Entrepôt supprimé avec succès");
        setWarehouses(prev => prev.filter(w => w.id !== selectedWarehouse.id));
        setShowDeleteDialog(false);
        setSelectedWarehouse(null);
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open create dialog
  const openCreateDialog = () => {
    setSelectedWarehouse(null);
    setFormData({
      name: "",
      code: "",
      address: "",
      is_default: false,
      is_active: true,
      allow_negative_stock: false,
    });
    setShowWarehouseDialog(true);
  };

  // Open edit dialog
  const openEditDialog = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address || "",
      is_default: warehouse.is_default,
      is_active: warehouse.is_active,
      allow_negative_stock: warehouse.allow_negative_stock,
    });
    setShowWarehouseDialog(true);
  };

  // Filter warehouses
  const filteredWarehouses = (Array.isArray(warehouses) ? warehouses : []).filter(
    w =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Computed stats
  const safeStocks = Array.isArray(stocks) ? stocks : [];
  const safeWarehouses = Array.isArray(warehouses) ? warehouses : [];
  const safeLowStock = Array.isArray(lowStockItems) ? lowStockItems : [];
  const safeExpiring = Array.isArray(expiringBatches) ? expiringBatches : [];

  const totalProducts = new Set(safeStocks.map(s => s.product)).size;
  const totalQuantity = safeStocks.reduce((sum, s) => sum + parseFloat(s.quantity || "0"), 0);
  const totalValue = safeWarehouses.reduce((sum, w) => sum + parseFloat(w.stock_value || "0"), 0);
  const outOfStock = safeStocks.filter(s => parseFloat(s.quantity) <= 0).length;

  // Movement type config
  const getMovementConfig = (type: string) => {
    const configs: Record<string, { icon: typeof ArrowDownToLine; color: string; bg: string }> = {
      purchase: { icon: ArrowDownToLine, color: "text-green-600", bg: "bg-green-50" },
      sale: { icon: ArrowUpFromLine, color: "text-blue-600", bg: "bg-blue-50" },
      return_in: { icon: ArrowDownToLine, color: "text-cyan-600", bg: "bg-cyan-50" },
      return_out: { icon: ArrowUpFromLine, color: "text-orange-600", bg: "bg-orange-50" },
      transfer_in: { icon: ArrowDownToLine, color: "text-indigo-600", bg: "bg-indigo-50" },
      transfer_out: { icon: ArrowUpFromLine, color: "text-indigo-600", bg: "bg-indigo-50" },
      adjustment_in: { icon: ArrowDownToLine, color: "text-amber-600", bg: "bg-amber-50" },
      adjustment_out: { icon: ArrowUpFromLine, color: "text-amber-600", bg: "bg-amber-50" },
      damage: { icon: PackageX, color: "text-red-600", bg: "bg-red-50" },
      expired: { icon: PackageX, color: "text-red-600", bg: "bg-red-50" },
      initial: { icon: PackageCheck, color: "text-green-600", bg: "bg-green-50" },
    };
    return configs[type] || { icon: Activity, color: "text-gray-600", bg: "bg-gray-50" };
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion de stock</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vue d'ensemble de vos entrepôts, niveaux de stock et mouvements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/stock/movements")}
          >
            <Activity className="h-4 w-4 mr-2" />
            Entrée de stock
          </Button>
          <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel entrepôt
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <WarehouseIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{safeWarehouses.length}</p>
                <p className="text-xs text-gray-500">Entrepôts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalProducts}</p>
                <p className="text-xs text-gray-500">Produits en stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{safeLowStock.length}</p>
                <p className="text-xs text-gray-500">Stock bas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <PackageX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
                <p className="text-xs text-gray-500">En rupture</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0 col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatPrice(totalValue)}</p>
                <p className="text-xs text-gray-500">Valeur totale</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/dashboard/stock/stock-levels">
          <Card className="p-0 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500">
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium text-sm">Niveaux de stock</p>
                <p className="text-xs text-gray-500">{totalQuantity.toFixed(0)} unités</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/stock/movements">
          <Card className="p-0 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-500">
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="font-medium text-sm">Mouvements</p>
                <p className="text-xs text-gray-500">Historique complet</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/stock/transfers">
          <Card className="p-0 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-cyan-500">
            <CardContent className="p-4 flex items-center gap-3">
              <ArrowLeftRight className="h-5 w-5 text-cyan-600" />
              <div>
                <p className="font-medium text-sm">Transferts</p>
                <p className="text-xs text-gray-500">Entre entrepôts</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/stock/adjustments">
          <Card className="p-0 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-500">
            <CardContent className="p-4 flex items-center gap-3">
              <SlidersHorizontal className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-sm">Ajustements</p>
                <p className="text-xs text-gray-500">Corrections</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Warehouses + Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Warehouses */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold">Entrepôts</h2>
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm max-w-md"
                />
              </div>
            </div>

            {filteredWarehouses.length === 0 ? (
              <Card className="p-0">
                <CardContent className="p-8 text-center">
                  <WarehouseIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun entrepôt</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Créez votre premier entrepôt pour commencer à gérer votre stock.
                  </p>
                  <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un entrepôt
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredWarehouses.map(warehouse => (
                  <Link key={warehouse.id} href={`/dashboard/stock/warehouses/${warehouse.id}`}>
                    <Card className="p-0 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <WarehouseIcon className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{warehouse.name}</h3>
                              <p className="text-xs text-gray-500">{warehouse.code}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/dashboard/stock/warehouses/${warehouse.id}`)
                                }
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(warehouse)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedWarehouse(warehouse);
                                  setShowDeleteDialog(true);
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {warehouse.address && (
                          <div className="flex items-start gap-2 text-sm text-gray-500 mb-3">
                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-1">{warehouse.address}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-3">
                          {warehouse.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              Par défaut
                            </Badge>
                          )}
                          <Badge
                            variant={warehouse.is_active ? "default" : "secondary"}
                            className={warehouse.is_active ? "bg-green-100 text-green-700" : ""}
                          >
                            {warehouse.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </div>

                        <div className="pt-3 border-t">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Valeur du stock</span>
                            <span className="font-semibold">
                              {formatPrice(warehouse.stock_value || "0")}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Movements */}
        <div className="flex flex-col gap-5">

          {/* Alerts */}
          {(safeLowStock.length > 0 || safeExpiring.length > 0) && (
            <div className="space-y-4">
              {safeLowStock.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-500" />
                      Stock bas ({safeLowStock.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {safeLowStock.slice(0, 4).map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-orange-50 rounded-lg"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{item.product_name}</p>
                            <p className="text-xs text-gray-500">{item.warehouse_name}</p>
                          </div>
                          <span className="font-semibold text-orange-600 text-sm ml-2">
                            {parseFloat(item.quantity).toFixed(0)}
                          </span>
                        </div>
                      ))}
                      {safeLowStock.length > 4 && (
                        <Link
                          href="/dashboard/stock/stock-levels?filter=low"
                          className="block text-center text-sm text-orange-600 hover:underline pt-1"
                        >
                          Voir tous →
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {safeExpiring.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Lots expirants ({safeExpiring.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {safeExpiring.slice(0, 4).map(batch => (
                        <div
                          key={batch.id}
                          className="flex items-center justify-between p-2 bg-red-50 rounded-lg"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{batch.product_name}</p>
                            <p className="text-xs text-gray-500">Lot: {batch.batch_number}</p>
                          </div>
                          <div className="text-right ml-2">
                            <p className="font-semibold text-red-600 text-sm">
                              {batch.days_until_expiry}j
                            </p>
                          </div>
                        </div>
                      ))}
                      {safeExpiring.length > 4 && (
                        <Link
                          href="/dashboard/stock/stock-levels"
                          className="block text-center text-sm text-red-600 hover:underline pt-1"
                        >
                          Voir tous →
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" />
                  Derniers mouvements
                </CardTitle>
                <Link
                  href="/dashboard/stock/movements"
                  className="text-xs text-orange-600 hover:underline"
                >
                  Voir tout →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {recentMovements.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucun mouvement récent</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMovements.slice(0, 4).map(movement => {
                    const config = getMovementConfig(movement.movement_type);
                    const MovIcon = config.icon;
                    const qty = parseFloat(movement.quantity);
                    return (
                      <div
                        key={movement.id}
                        className={`flex items-center gap-3 p-2 rounded-lg ${config.bg}`}
                      >
                        <div className={`p-1.5 rounded ${config.color}`}>
                          <MovIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {movement.product_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {movement.movement_type_display} • {movement.warehouse_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${qty > 0 ? "text-green-600" : "text-red-600"
                              }`}
                          >
                            {qty > 0 ? "+" : ""}
                            {qty.toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDateTime(movement.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Warehouse Dialog */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedWarehouse ? "Modifier l'entrepôt" : "Nouvel entrepôt"}
            </DialogTitle>
            <DialogDescription>
              {selectedWarehouse
                ? "Modifiez les informations de l'entrepôt"
                : "Créez un nouvel entrepôt pour stocker vos produits"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Entrepôt principal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ex: WH001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Adresse de l'entrepôt"
                rows={2}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_default">Entrepôt par défaut</Label>
                  <p className="text-xs text-gray-500">
                    Utilisé par défaut pour les nouvelles opérations
                  </p>
                </div>
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={checked => setFormData({ ...formData, is_default: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Actif</Label>
                  <p className="text-xs text-gray-500">L'entrepôt peut recevoir des opérations</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allow_negative_stock">Autoriser stock négatif</Label>
                  <p className="text-xs text-gray-500">Permet de vendre sans stock disponible</p>
                </div>
                <Switch
                  id="allow_negative_stock"
                  checked={formData.allow_negative_stock}
                  onCheckedChange={checked =>
                    setFormData({ ...formData, allow_negative_stock: checked })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWarehouseDialog(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedWarehouse ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer l'entrepôt</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'entrepôt &quot;{selectedWarehouse?.name}&quot; ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
