"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Search,
  Loader2,
  Plus,
  ClipboardList,
  MoreVertical,
  Eye,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Warehouse as WarehouseIcon,
  Lock,
  Unlock,
  Trash2,
  AlertTriangle,
  BarChart3,
  Package,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatPrice, formatDecimal } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getWarehouses, Warehouse, getWarehouseStockSummary } from "@/actions/stock.actions";
import { getCategories, getProducts, Category, Product } from "@/actions/products.actions";
import {
  getInventorySessions,
  createInventorySession,
  deleteInventorySession,
  startInventorySession,
  cancelInventorySession,
  InventorySession,
  InventorySessionStatus,
  InventoryScopeType,
  InventorySessionFilters,
  CreateInventorySessionData,
} from "@/actions/inventory.actions";
import { DataPagination } from "@/components/shared/DataPagination";

const statusConfig: Record<InventorySessionStatus, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-700", icon: Play },
  review: { label: "En révision", color: "bg-orange-100 text-orange-700", icon: Eye },
  validated: { label: "Validé", color: "bg-green-100 text-green-700", icon: CheckCircle },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700", icon: XCircle },
};

const scopeConfig: Record<InventoryScopeType, { label: string }> = {
  full: { label: "Complet" },
  category: { label: "Par catégorie" },
  product: { label: "Par produit" },
};

export default function InventoryPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseStockCounts, setWarehouseStockCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const todayFormatted = new Date().toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const [newSession, setNewSession] = useState<CreateInventorySessionData>({
    name: `Inventaire du ${todayFormatted}`,
    warehouse: "",
    scope_type: "full",
    notes: "",
    category_ids: [],
    product_ids: [],
  });

  // Delete dialog
  const [sessionToDelete, setSessionToDelete] = useState<InventorySession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Start dialog
  const [sessionToStart, setSessionToStart] = useState<InventorySession | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Cancel dialog
  const [sessionToCancel, setSessionToCancel] = useState<InventorySession | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch organization
  useEffect(() => {
    async function fetchOrg() {
      if (session?.accessToken) {
        const result = await getUserOrganizations(session.accessToken);
        if (result.success && result.data && result.data.length > 0) {
          setOrganization(result.data[0]);
        }
      }
    }
    fetchOrg();
  }, [session?.accessToken]);

  // Fetch warehouses, categories, and products
  useEffect(() => {
    async function fetchData() {
      if (!session?.accessToken || !organization?.id) return;
      const [whResult, catResult, prodResult] = await Promise.all([
        getWarehouses(session.accessToken, organization.id),
        getCategories(session.accessToken, organization.id),
        getProducts(session.accessToken, organization.id, { page_size: 500, is_active: true }),
      ]);
      if (whResult.success && whResult.data) {
        setWarehouses(whResult.data);
        // Fetch stock summary for each warehouse to know which have products
        const stockCounts: Record<string, number> = {};
        const token = session.accessToken;
        const orgId = organization.id;
        await Promise.all(
          whResult.data.map(async (wh) => {
            const summary = await getWarehouseStockSummary(token, orgId, wh.id);
            if (summary.success && summary.data) {
              stockCounts[wh.id] = summary.data.total_products;
            }
          })
        );
        setWarehouseStockCounts(stockCounts);
      }
      if (catResult.success && catResult.data) setCategories(catResult.data.results || []);
      if (prodResult.success && prodResult.data) setProducts(prodResult.data.results || []);
    }
    fetchData();
  }, [session?.accessToken, organization?.id]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const filters: InventorySessionFilters = {
      search: search || undefined,
      status: statusFilter !== "all" ? (statusFilter as InventorySessionStatus) : undefined,
      warehouse: warehouseFilter !== "all" ? warehouseFilter : undefined,
      page: currentPage,
      page_size: pageSize,
    };
    const result = await getInventorySessions(session.accessToken, organization.id, filters);
    if (result.success && result.data) {
      setSessions(result.data.results || []);
      setTotalCount(result.data.count || 0);
      setHasNext(result.data.next !== null);
      setHasPrevious(result.data.previous !== null);
    }
    setIsLoading(false);
  }, [session?.accessToken, organization?.id, search, statusFilter, warehouseFilter, currentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Create session
  const handleCreate = async () => {
    if (!session?.accessToken || !organization?.id) return;
    if (!newSession.warehouse) {
      toast.error("L'entrepôt est requis");
      return;
    }
    if (newSession.scope_type === "category" && (!newSession.category_ids || newSession.category_ids.length === 0)) {
      toast.error("Sélectionnez au moins une catégorie");
      return;
    }
    if (newSession.scope_type === "product" && (!newSession.product_ids || newSession.product_ids.length === 0)) {
      toast.error("Sélectionnez au moins un produit");
      return;
    }
    setIsCreating(true);
    const result = await createInventorySession(session.accessToken, organization.id, newSession);
    if (result.success) {
      toast.success(result.message);
      setShowCreateDialog(false);
      const newDate = new Date().toLocaleDateString("fr-CD", { day: "2-digit", month: "long", year: "numeric" });
      setNewSession({ name: `Inventaire du ${newDate}`, warehouse: "", scope_type: "full", notes: "", category_ids: [], product_ids: [] });
      setProductSearch("");
      fetchSessions();
    } else {
      toast.error(result.message);
    }
    setIsCreating(false);
  };

  // Filtered products for search in product scope
  const filteredProducts = products.filter((p) => {
    if (!productSearch) return true;
    const s = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.sku || "").toLowerCase().includes(s);
  });

  // Delete session
  const handleDelete = async () => {
    if (!sessionToDelete || !session?.accessToken || !organization?.id) return;
    setIsDeleting(true);
    const result = await deleteInventorySession(session.accessToken, organization.id, sessionToDelete.id);
    if (result.success) {
      toast.success(result.message);
      setSessionToDelete(null);
      fetchSessions();
    } else {
      toast.error(result.message);
    }
    setIsDeleting(false);
  };

  // Start session
  const handleStart = async () => {
    if (!sessionToStart || !session?.accessToken || !organization?.id) return;
    setIsStarting(true);
    const result = await startInventorySession(session.accessToken, organization.id, sessionToStart.id);
    if (result.success) {
      toast.success(result.message);
      setSessionToStart(null);
      router.push(`/dashboard/inventory/${result.data?.id}`);
    } else {
      toast.error(result.message);
    }
    setIsStarting(false);
  };

  // Cancel session
  const handleCancel = async () => {
    if (!sessionToCancel || !session?.accessToken || !organization?.id) return;
    setIsCancelling(true);
    const result = await cancelInventorySession(session.accessToken, organization.id, sessionToCancel.id);
    if (result.success) {
      toast.success(result.message);
      setSessionToCancel(null);
      fetchSessions();
    } else {
      toast.error(result.message);
    }
    setIsCancelling(false);
  };

  // Stats
  const activeCount = sessions.filter(s => s.status === "in_progress").length;
  const reviewCount = sessions.filter(s => s.status === "review").length;
  const draftCount = sessions.filter(s => s.status === "draft").length;
  const validatedCount = sessions.filter(s => s.status === "validated").length;

  if (isLoading && sessions.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Inventaire</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez vos sessions d'inventaire et comptages de stock
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Nouvel inventaire
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-gray-500">En cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Eye className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewCount}</p>
                <p className="text-xs text-gray-500">En révision</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{draftCount}</p>
                <p className="text-xs text-gray-500">Brouillons</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{validatedCount}</p>
                <p className="text-xs text-gray-500">Validés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par référence ou nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="review">En révision</SelectItem>
            <SelectItem value="validated">Validé</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Entrepôt" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les entrepôts</SelectItem>
            {warehouses.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun inventaire</h3>
            <p className="text-gray-500 mb-4">
              Créez votre premier inventaire pour commencer le comptage de stock
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Nouvel inventaire
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Entrepôt</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Progression</TableHead>
                    <TableHead className="text-right">Écart valeur</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((inv) => {
                    const statusCfg = statusConfig[inv.status];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}>
                        <TableCell className="font-mono text-sm">{inv.reference}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{inv.name}</span>
                            {inv.is_stock_locked && (
                              <Lock className="h-3.5 w-3.5 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-sm text-gray-600">
                            <WarehouseIcon className="h-3.5 w-3.5" />
                            {inv.warehouse_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {scopeConfig[inv.scope_type]?.label}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusCfg.color} text-xs`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {inv.status !== "draft" && inv.items_total > 0 ? (
                            <div className="w-32 space-y-1">
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>{inv.items_counted}/{inv.items_total}</span>
                                <span>{inv.progress_percentage}%</span>
                              </div>
                              <Progress value={inv.progress_percentage} className="h-1.5" />
                              {inv.items_with_difference > 0 && (
                                <p className="text-xs text-orange-600">{inv.items_with_difference} écart(s)</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {inv.status === "validated" && parseFloat(inv.total_difference_value) !== 0 ? (
                            <span className={`text-sm font-semibold ${parseFloat(inv.total_difference_value) > 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatPrice(inv.total_difference_value)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{formatDate(inv.created_at)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/inventory/${inv.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir détails
                              </DropdownMenuItem>
                              {inv.status === "draft" && (
                                <>
                                  <DropdownMenuItem onClick={() => setSessionToStart(inv)}>
                                    <Play className="h-4 w-4 mr-2" />
                                    Démarrer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setSessionToDelete(inv)} className="text-red-600">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(inv.status === "in_progress" || inv.status === "review") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setSessionToCancel(inv)} className="text-red-600">
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Annuler
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t">
                <DataPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  hasNext={hasNext}
                  hasPrevious={hasPrevious}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel inventaire</DialogTitle>
            <DialogDescription>
              Créez une session d&apos;inventaire pour compter le stock
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date de l&apos;inventaire</Label>
              <div className="flex items-center gap-2 bg-gray-50 border rounded-md px-3 py-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{todayFormatted}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entrepôt *</Label>
              <SearchableSelect
                options={warehouses.map((wh) => ({
                  value: wh.id,
                  label: `${wh.name}${(warehouseStockCounts[wh.id] || 0) === 0 ? " (vide)" : ` (${warehouseStockCounts[wh.id]} produits)`}`,
                }))}
                value={newSession.warehouse}
                onValueChange={(val) => setNewSession({ ...newSession, warehouse: val })}
                placeholder="Sélectionner un entrepôt"
              />
              {newSession.warehouse && (warehouseStockCounts[newSession.warehouse] || 0) === 0 && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Cet entrepôt ne contient aucun produit en stock.</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Type d&apos;inventaire</Label>
              <Select
                value={newSession.scope_type}
                onValueChange={(val) => setNewSession({
                  ...newSession,
                  scope_type: val as InventoryScopeType,
                  category_ids: [],
                  product_ids: [],
                })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Inventaire complet (tous les produits)</SelectItem>
                  <SelectItem value="category">Par catégorie</SelectItem>
                  <SelectItem value="product">Par produit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newSession.scope_type === "category" && (
              <div className="space-y-2">
                <Label>Catégories *</Label>
                {(newSession.category_ids?.length || 0) > 0 && (
                  <p className="text-xs text-orange-600">{newSession.category_ids?.length} catégorie(s) sélectionnée(s)</p>
                )}
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center justify-between gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newSession.category_ids?.includes(cat.id) || false}
                          onChange={(e) => {
                            const ids = newSession.category_ids || [];
                            setNewSession({
                              ...newSession,
                              category_ids: e.target.checked
                                ? [...ids, cat.id]
                                : ids.filter((id) => id !== cat.id),
                            });
                          }}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span>{cat.name}</span>
                      </div>
                      {cat.products_count !== undefined && (
                        <span className="text-xs text-gray-400">{cat.products_count} produit(s)</span>
                      )}
                    </label>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">Aucune catégorie disponible</p>
                  )}
                </div>
              </div>
            )}
            {newSession.scope_type === "product" && (
              <div className="space-y-2">
                <Label>Produits *</Label>
                {(newSession.product_ids?.length || 0) > 0 && (
                  <p className="text-xs text-orange-600">{newSession.product_ids?.length} produit(s) sélectionné(s)</p>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un produit par nom ou SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
                  {filteredProducts.map((prod) => (
                    <label key={prod.id} className="flex items-center justify-between gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newSession.product_ids?.includes(prod.id) || false}
                          onChange={(e) => {
                            const ids = newSession.product_ids || [];
                            setNewSession({
                              ...newSession,
                              product_ids: e.target.checked
                                ? [...ids, prod.id]
                                : ids.filter((id) => id !== prod.id),
                            });
                          }}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <div>
                          <span>{prod.name}</span>
                          {prod.sku && <span className="text-xs text-gray-400 ml-2 font-mono">{prod.sku}</span>}
                        </div>
                      </div>
                      {prod.category_name && (
                        <span className="text-xs text-gray-400">{prod.category_name}</span>
                      )}
                    </label>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">Aucun produit trouvé</p>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                placeholder="Notes ou instructions pour l'inventaire..."
                value={newSession.notes}
                onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || (newSession.warehouse && (warehouseStockCounts[newSession.warehouse] || 0) === 0) as boolean}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Confirmation Dialog */}
      <Dialog open={!!sessionToStart} onOpenChange={() => setSessionToStart(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Démarrer l'inventaire</DialogTitle>
            <DialogDescription>
              Le stock des produits concernés sera <strong>verrouillé</strong> pendant toute la durée de l'inventaire.
              Aucun mouvement de stock ne sera possible pour ces produits dans cet entrepôt.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Attention</p>
              <p>Les ventes et réceptions seront bloquées pour les produits de cet entrepôt jusqu'à la fin de l'inventaire.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionToStart(null)}>
              Annuler
            </Button>
            <Button onClick={handleStart} disabled={isStarting} className="bg-blue-600 hover:bg-blue-700">
              {isStarting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Lock className="h-4 w-4 mr-2" />
              Démarrer et verrouiller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l'inventaire</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'inventaire "{sessionToDelete?.name}" ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionToDelete(null)}>
              Annuler
            </Button>
            <Button onClick={handleDelete} disabled={isDeleting} variant="destructive">
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!sessionToCancel} onOpenChange={() => setSessionToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler l'inventaire</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler l'inventaire "{sessionToCancel?.name}" ?
              Le stock sera déverrouillé et les comptages perdus.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Cette action est irréversible</p>
              <p>Tous les comptages effectués seront perdus.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionToCancel(null)}>
              Retour
            </Button>
            <Button onClick={handleCancel} disabled={isCancelling} variant="destructive">
              {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Annuler l'inventaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
