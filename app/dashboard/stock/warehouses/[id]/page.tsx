"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  User,
  Package,
  TrendingDown,
  AlertTriangle,
  Pencil,
  Trash2,
  Settings,
  BarChart3,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatPrice, formatNumber } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getWarehouse,
  getWarehouseStockSummary,
  getStockByWarehouse,
  getStockLocations,
  createStockLocation,
  deleteWarehouse,
  Warehouse,
  Stock,
  StockLocation,
  WarehouseStockSummary,
  CreateStockLocationData,
} from "@/actions/stock.actions";

export default function WarehouseDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const warehouseId = params.id as string;

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [stockSummary, setStockSummary] = useState<WarehouseStockSummary | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateLocationDialog, setShowCreateLocationDialog] = useState(false);
  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [locationFormData, setLocationFormData] = useState<CreateStockLocationData>({
    name: "",
    code: "",
    warehouse: warehouseId,
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

          // Fetch warehouse details
          const warehouseResult = await getWarehouse(session.accessToken, org.id, warehouseId);
          if (warehouseResult.success && warehouseResult.data) {
            setWarehouse(warehouseResult.data);
          }

          // Fetch stock summary
          const summaryResult = await getWarehouseStockSummary(
            session.accessToken,
            org.id,
            warehouseId
          );
          if (summaryResult.success && summaryResult.data) {
            setStockSummary(summaryResult.data);
          }

          // Fetch stocks
          const stocksResult = await getStockByWarehouse(session.accessToken, org.id, warehouseId);
          if (stocksResult.success && stocksResult.data) {
            setStocks(stocksResult.data);
          }

          // Fetch locations
          const locationsResult = await getStockLocations(session.accessToken, org.id, warehouseId);
          if (locationsResult.success && locationsResult.data) {
            setLocations(locationsResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching warehouse details:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, warehouseId]);

  // Handle create location
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    setIsCreatingLocation(true);

    try {
      const result = await createStockLocation(
        session.accessToken,
        organization.id,
        { ...locationFormData, warehouse: warehouseId }
      );

      if (result.success) {
        toast.success("Emplacement créé avec succès");
        setShowCreateLocationDialog(false);
        setLocationFormData({ name: "", code: "", warehouse: warehouseId });

        // Refresh locations
        const locationsResult = await getStockLocations(session.accessToken, organization.id, warehouseId);
        if (locationsResult.success && locationsResult.data) {
          setLocations(locationsResult.data);
        }
      } else {
        toast.error(result.message || "Erreur lors de la création");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsCreatingLocation(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsDeleting(true);

    try {
      const result = await deleteWarehouse(session.accessToken, organization.id, warehouseId);
      if (result.success) {
        toast.success("Entrepôt supprimé avec succès");
        router.push("/dashboard/stock");
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsDeleting(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Entrepôt introuvable</h1>
          </div>
        </div>
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Cet entrepôt n'existe pas ou a été supprimé.</p>
            <Button onClick={() => router.push("/dashboard/stock")} className="mt-4">
              Retour à l'inventaire
            </Button>
          </CardContent>
        </Card>
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
            <h1 className="text-2xl font-bold text-gray-900">{warehouse.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Code: {warehouse.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/stock/warehouses/${warehouseId}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(stockSummary?.total_products || 0)} />
                <p className="text-xs text-gray-500">Produits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(stockSummary?.total_quantity || 0)} />
                <p className="text-xs text-gray-500">Quantité totale</p>
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
              <div className="min-w-0 flex-1">
                <StatValue value={String(stockSummary?.low_stock_count || 0)} />
                <p className="text-xs text-gray-500">Stock bas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(stockSummary?.out_of_stock_count || 0)} />
                <p className="text-xs text-gray-500">Rupture</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="stocks">Stock ({stocks.length})</TabsTrigger>
          <TabsTrigger value="locations">Emplacements ({locations.length})</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Détails de l'entrepôt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Nom</p>
                  <p className="text-base font-medium text-gray-900">{warehouse.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Code</p>
                  <p className="text-base font-medium text-gray-900">{warehouse.code}</p>
                </div>
                {warehouse.branch_name && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Succursale</p>
                    <p className="text-base font-medium text-gray-900">{warehouse.branch_name}</p>
                  </div>
                )}
                {warehouse.manager_name && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Gestionnaire</p>
                    <p className="text-base font-medium text-gray-900 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {warehouse.manager_name}
                    </p>
                  </div>
                )}
              </div>

              {warehouse.address && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Adresse</p>
                  <p className="text-base text-gray-900 flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                    {warehouse.address}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {warehouse.is_default && (
                  <Badge variant="secondary">Par défaut</Badge>
                )}
                <Badge variant={warehouse.is_active ? "default" : "secondary"} className={warehouse.is_active ? "bg-green-100 text-green-700" : ""}>
                  {warehouse.is_active ? "Actif" : "Inactif"}
                </Badge>
                {warehouse.allow_negative_stock && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    Stock négatif autorisé
                  </Badge>
                )}
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-gray-500 mb-2">Valeur totale du stock</p>
                <StatValue value={formatPrice(stockSummary?.total_value || 0)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stocks Tab */}
        <TabsContent value="stocks" className="space-y-4">
          {stocks.length === 0 ? (
            <Card className="p-0">
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun stock</h3>
                <p className="text-sm text-gray-500">
                  Cet entrepôt ne contient aucun produit pour le moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Produit
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Quantité
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Disponible
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Coût moyen
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                        Valeur
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stocks.map(stock => (
                      <tr key={stock.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{stock.product_name}</p>
                            <p className="text-xs text-gray-500">{stock.product_sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">
                            {parseFloat(stock.quantity).toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-green-600">
                            {parseFloat(stock.available_quantity).toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm">{formatPrice(stock.avg_cost)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">
                            {formatPrice(stock.stock_value || "0")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {locations.length} emplacement{locations.length > 1 ? 's' : ''}
            </p>
            <Button
              onClick={() => setShowCreateLocationDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvel emplacement
            </Button>
          </div>

          {locations.length === 0 ? (
            <Card className="p-0">
              <CardContent className="p-8 text-center">
                <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun emplacement</h3>
                <p className="text-sm text-gray-500">
                  Aucun emplacement de stockage n'a été défini pour cet entrepôt.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {locations.map(location => (
                <Card key={location.id} className="p-0">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{location.name}</h3>
                        <p className="text-xs text-gray-500">{location.code}</p>
                      </div>
                      <Badge variant={location.is_active ? "default" : "secondary"} className={location.is_active ? "bg-green-100 text-green-700" : ""}>
                        {location.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    {location.parent_name && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Parent: {location.parent_name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer l'entrepôt</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'entrepôt "{warehouse.name}" ? Cette action est
              irréversible et supprimera également tous les stocks et emplacements associés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Location Dialog */}
      <Dialog open={showCreateLocationDialog} onOpenChange={setShowCreateLocationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel emplacement</DialogTitle>
            <DialogDescription>
              Créer un nouvel emplacement de stockage pour {warehouse.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLocation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-name">Nom de l'emplacement *</Label>
              <Input
                id="location-name"
                value={locationFormData.name}
                onChange={e => setLocationFormData({ ...locationFormData, name: e.target.value })}
                placeholder="Ex: Allée A, Étagère 1, Zone froide..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-code">Code *</Label>
              <Input
                id="location-code"
                value={locationFormData.code}
                onChange={e => setLocationFormData({ ...locationFormData, code: e.target.value })}
                placeholder="Ex: A1, ETG-01, ZF-1..."
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateLocationDialog(false);
                  setLocationFormData({ name: "", code: "", warehouse: warehouseId });
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isCreatingLocation}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isCreatingLocation && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
