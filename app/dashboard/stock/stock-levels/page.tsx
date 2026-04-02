"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Package,
  Search,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  TrendingDown,
  Filter,
  Warehouse as WarehouseIcon,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatNumber } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { DataPagination } from "@/components/shared/DataPagination";
import {
  getStocks,
  getWarehouses,
  getLowStock,
  Stock,
  StockFilters,
  Warehouse,
} from "@/actions/stock.actions";

export default function StocksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showLowStock, setShowLowStock] = useState(searchParams.get("filter") === "low");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Organisation + entrepôts
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const warehousesResult = await getWarehouses(session.accessToken, org.id);
          if (warehousesResult.success && warehousesResult.data) {
            setWarehouses(warehousesResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken]);

  // Liste des stocks (API : recherche + entrepôt en mode normal ; stock bas = sous-ensemble puis filtre local)
  useEffect(() => {
    const token = session?.accessToken;
    const org = organization;
    if (!token || !org) return;

    let cancelled = false;
    const load = async () => {
      try {
        if (showLowStock) {
          const lowStockResult = await getLowStock(token, org.id);
          if (!cancelled && lowStockResult.success && lowStockResult.data) {
            setStocks(lowStockResult.data);
          }
          return;
        }
        const filters: StockFilters = {};
        if (debouncedSearch) filters.search = debouncedSearch;
        if (selectedWarehouse !== "all") filters.warehouse = selectedWarehouse;
        const stocksResult = await getStocks(token, org.id, filters);
        if (!cancelled && stocksResult.success && stocksResult.data) {
          setStocks(stocksResult.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching stocks:", error);
          toast.error("Erreur lors du chargement des stocks");
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, organization, showLowStock, debouncedSearch, selectedWarehouse]);

  const filteredStocks = useMemo(() => {
    if (!showLowStock) return stocks;
    const q = searchQuery.trim().toLowerCase();
    return stocks.filter(stock => {
      const matchesSearch =
        !q ||
        stock.product_name.toLowerCase().includes(q) ||
        stock.product_sku.toLowerCase().includes(q);
      const matchesWarehouse =
        selectedWarehouse === "all" || stock.warehouse === selectedWarehouse;
      return matchesSearch && matchesWarehouse;
    });
  }, [stocks, showLowStock, searchQuery, selectedWarehouse]);

  // Pagination
  const totalPages = Math.ceil(filteredStocks.length / pageSize);
  const paginatedStocks = filteredStocks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedWarehouse, showLowStock]);


  // Get stock status
  const getStockStatus = (stock: Stock) => {
    const qty = parseFloat(stock.quantity);
    const available = parseFloat(stock.available_quantity);

    if (qty <= 0) {
      return { label: "Rupture", color: "bg-red-100 text-red-700" };
    }
    if (available <= 0) {
      return { label: "Réservé", color: "bg-orange-100 text-orange-700" };
    }
    return { label: "En stock", color: "bg-green-100 text-green-700" };
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Niveaux de stock</h1>
          <p className="text-sm text-gray-500 mt-1">
            {showLowStock ? "Produits en stock bas" : "Vue d'ensemble de tout le stock"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            <Button
              variant={showLowStock ? "default" : "outline"}
              size="sm"
              onClick={() => setShowLowStock(!showLowStock)}
              className={showLowStock ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Stock bas
            </Button>

            <div className="hidden sm:flex items-center border rounded-lg">
              <Button
                variant="ghost"
                size="icon"
                className={viewMode === "list" ? "bg-gray-100" : ""}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={viewMode === "grid" ? "bg-gray-100" : ""}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={String(filteredStocks.length)} />
                <p className="text-xs text-gray-500">Produits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <StatValue value={filteredStocks.reduce((sum, s) => sum + parseFloat(s.quantity), 0).toFixed(0)} />
                <p className="text-xs text-gray-500">Quantité totale</p>
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
              <div className="min-w-0 flex-1">
                <StatValue value={formatPrice(
                  filteredStocks.reduce((sum, s) => sum + parseFloat(s.stock_value || "0"), 0)
                )} />
                <p className="text-xs text-gray-500">Valeur totale</p>
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
                <StatValue value={String(filteredStocks.filter(s => parseFloat(s.quantity) <= 0).length)} />
                <p className="text-xs text-gray-500">En rupture</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock List */}
      {filteredStocks.length === 0 ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun stock trouvé</h3>
            <p className="text-sm text-gray-500">
              {searchQuery || selectedWarehouse !== "all"
                ? "Essayez de modifier vos filtres"
                : "Le stock sera affiché une fois que vous aurez des produits"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Produit
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Entrepôt
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Quantité
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Réservé
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
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedStocks.map(stock => {
                  const status = getStockStatus(stock);
                  return (
                    <tr key={stock.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{stock.product_name}</p>
                          <p className="text-xs text-gray-500">{stock.product_sku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{stock.warehouse_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">
                          {parseFloat(stock.quantity).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-gray-500">
                          {parseFloat(stock.reserved_quantity).toFixed(0)}
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
                        <span className="font-medium">{formatPrice(stock.stock_value || "0")}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={status.color}>{status.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasNext={currentPage < totalPages}
                hasPrevious={currentPage > 1}
              />
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedStocks.map(stock => {
              const status = getStockStatus(stock);
              return (
                <Card key={stock.id} className="p-0">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900">{stock.product_name}</h3>
                        <p className="text-xs text-gray-500">{stock.product_sku}</p>
                      </div>
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <WarehouseIcon className="h-4 w-4" />
                      <span>{stock.warehouse_name}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <StatValue value={parseFloat(stock.quantity).toFixed(0)} />
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div>
                        <StatValue value={parseFloat(stock.reserved_quantity).toFixed(0)} color="text-orange-600" />
                        <p className="text-xs text-gray-500">Réservé</p>
                      </div>
                      <div>
                        <StatValue value={parseFloat(stock.available_quantity).toFixed(0)} color="text-green-600" />
                        <p className="text-xs text-gray-500">Disponible</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                      <span className="text-gray-500">Valeur</span>
                      <span className="font-medium">{formatPrice(stock.stock_value || "0")}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4">
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                hasNext={currentPage < totalPages}
                hasPrevious={currentPage > 1}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
