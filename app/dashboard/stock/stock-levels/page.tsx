"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import {
  createWarehouseSearchHandler,
  createCategorySearchHandler,
} from "@/lib/select-search-handlers";
import { ExportMenu } from "@/components/shared/ExportMenu";
import {
  Package,
  Search,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  BarChart3,
  Boxes,
  TrendingDown,
  Filter,
  Warehouse as WarehouseIcon,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatNumber } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { StatStrip, StatStripItem } from "@/components/shared/StatStrip";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { DataPagination } from "@/components/shared/DataPagination";
import { ProductThumb } from "@/components/products/product-thumb";
import {
  getStocks,
  exportStockLevels,
  Stock,
  StockFilters,
} from "@/actions/stock.actions";

export default function StocksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedWarehouseLabel, setSelectedWarehouseLabel] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
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

          // Liste des entrepôts chargée à la volée via le SearchableSelectAsync
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

  // Filtres envoyés au serveur. Mémoïsés pour que l'effet de chargement ne se
  // redéclenche pas à chaque rendu sur un objet pourtant identique.
  const currentFilters = useMemo<StockFilters>(() => {
    const filters: StockFilters = {};
    if (debouncedSearch) filters.search = debouncedSearch;
    if (selectedWarehouse !== "all") filters.warehouse = selectedWarehouse;
    if (selectedCategory !== "all") filters.category = selectedCategory;
    if (showLowStock) filters.status = "low";
    return filters;
  }, [debouncedSearch, selectedWarehouse, selectedCategory, showLowStock]);

  // Liste des stocks : tous les filtres sont appliqués côté serveur.
  useEffect(() => {
    const token = session?.accessToken;
    const org = organization;
    if (!token || !org) return;

    let cancelled = false;
    const load = async () => {
      try {
        const stocksResult = await getStocks(token, org.id, currentFilters);
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
  }, [session?.accessToken, organization, currentFilters]);

  // Plus de tri en mémoire : recherche, entrepôt, catégorie et « stock bas »
  // sont tous appliqués par le serveur. C'est ce qui garantit que le fichier
  // exporté couvre exactement le même périmètre que la liste affichée.
  const filteredStocks = stocks;

  // Pagination
  const totalPages = Math.ceil(filteredStocks.length / pageSize);
  const paginatedStocks = filteredStocks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedWarehouse, selectedCategory, showLowStock]);


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
      {/* En-tête. Le bouton d'export descend sous le titre dès que la largeur
          manque : à le garder sur la même ligne, c'est le titre qui cédait et
          « Niveaux de stock » se cassait en deux, la flèche de retour perdant
          au passage le repère de la ligne de base. */}
      <div className="flex items-start gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="-ml-2 shrink-0"
          aria-label="Revenir à la page précédente"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          {/* `items-start` empêche le bouton d'export de s'étirer sur toute la
              largeur une fois empilé : un bouton pleine largeur se lit comme
              l'action principale de la page, ce qu'un export n'est pas. */}
          <div className="min-w-0 max-w-full">
            <h1 className="text-balance text-2xl font-bold text-gray-900">
              Niveaux de stock
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {showLowStock ? "Produits en stock bas" : "Vue d'ensemble de tout le stock"}
            </p>
          </div>

          <ExportMenu
            disabled={!session?.accessToken || !organization?.id || stocks.length === 0}
            disabledReason="Aucun stock à exporter"
            targets={[
              {
                key: "stock-levels",
                label: "Situation de stock",
                run: (format) =>
                  exportStockLevels(
                    session!.accessToken as string,
                    organization!.id,
                    format,
                    { ...currentFilters, group_by: "category" }
                  ),
              },
            ]}
          />
        </div>
      </div>

      {/* Filtres. Le groupe de droite portait un `flex` sans retour à la ligne :
          aux largeurs intermédiaires, le troisième contrôle sortait de l'écran
          et rien ne le rattrapait, la page n'ayant pas de défilement horizontal
          à ce niveau. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="relative w-full lg:max-w-lg lg:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelectAsyncWithEmpty
            value={selectedWarehouse === "all" ? null : selectedWarehouse}
            onValueChange={(value, label) => {
              setSelectedWarehouse(value ?? "all");
              setSelectedWarehouseLabel(label ?? "");
            }}
            onSearch={
              session?.accessToken && organization?.id
                ? createWarehouseSearchHandler(session.accessToken, organization.id)
                : async () => []
            }
            emptyLabel="Tous les entrepôts"
            placeholder="Entrepôt"
            searchPlaceholder="Rechercher un entrepôt..."
            className="max-w-max"
            disabled={!session?.accessToken || !organization?.id}
          />

          <SearchableSelectAsyncWithEmpty
            value={selectedCategory === "all" ? null : selectedCategory}
            onValueChange={(value) => setSelectedCategory(value ?? "all")}
            onSearch={
              session?.accessToken && organization?.id
                ? createCategorySearchHandler(session.accessToken, organization.id)
                : async () => []
            }
            emptyLabel="Toutes les catégories"
            placeholder="Catégorie"
            searchPlaceholder="Rechercher une catégorie..."
            className="max-w-max"
            disabled={!session?.accessToken || !organization?.id}
          />

          <Button
            variant={showLowStock ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLowStock(!showLowStock)}
            aria-pressed={showLowStock}
            className={`shrink-0 ${showLowStock ? "bg-orange-500 hover:bg-orange-600" : ""}`}
          >
            <TrendingDown className="h-4 w-4 mr-2" />
            Stock bas
          </Button>

          {/* Contrôle segmenté : il se replie d'un bloc, jamais en deux. */}
          <div className="hidden shrink-0 items-center rounded-lg border sm:flex">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Affichage en liste"
              aria-pressed={viewMode === "list"}
              className={viewMode === "list" ? "bg-gray-100" : ""}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Affichage en grille"
              aria-pressed={viewMode === "grid"}
              className={viewMode === "grid" ? "bg-gray-100" : ""}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Relevés de la sélection courante : ils suivent les filtres, ils ne
          se cliquent pas. Même bandeau que la page « Gestion de stock », pour
          qu'un chiffre se lise pareil d'un écran à l'autre. */}
      <StatStrip className="lg:grid-cols-4">
        <StatStripItem
          label="Produits"
          value={String(filteredStocks.length)}
          icon={Package}
        />
        <StatStripItem
          label="Unités au total"
          value={formatNumber(
            filteredStocks.reduce((sum, s) => sum + parseFloat(s.quantity), 0)
          )}
          icon={Boxes}
          hint="Somme en unités de détail, tous produits confondus. Les contenants scellés y comptent pour leur contenu."
        />
        <StatStripItem
          label="Valeur totale"
          value={formatPrice(
            filteredStocks.reduce((sum, s) => sum + parseFloat(s.stock_value || "0"), 0)
          )}
          icon={BarChart3}
          tone="accent"
        />
        <StatStripItem
          label="En rupture"
          value={String(
            filteredStocks.filter(s => parseFloat(s.quantity) <= 0).length
          )}
          icon={AlertTriangle}
          tone="alert"
        />
      </StatStrip>

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
                        <div className="flex items-center gap-3">
                          <ProductThumb
                            src={stock.product_image}
                            alt={stock.product_name}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {stock.product_name}
                            </p>
                            <p className="text-xs text-gray-500">{stock.product_sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{stock.warehouse_name}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">
                          {stock.stock_display || parseFloat(stock.quantity).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-gray-500">
                          {stock.reserved_display?.trim() ||
                            parseFloat(stock.reserved_quantity).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-green-600">
                          {stock.available_display?.trim() ||
                            parseFloat(stock.available_quantity).toFixed(0)}
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
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb
                          src={stock.product_image}
                          alt={stock.product_name}
                          size="md"
                        />
                        <div className="min-w-0">
                          <h3 className="truncate font-medium text-gray-900">
                            {stock.product_name}
                          </h3>
                          <p className="text-xs text-gray-500">{stock.product_sku}</p>
                        </div>
                      </div>
                      <Badge className={status.color}>{status.label}</Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <WarehouseIcon className="h-4 w-4" />
                      <span>{stock.warehouse_name}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <StatValue
                          value={stock.stock_display || parseFloat(stock.quantity).toFixed(0)}
                        />
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div>
                        <StatValue
                          value={
                            stock.reserved_display?.trim() ||
                            parseFloat(stock.reserved_quantity).toFixed(0)
                          }
                          color="text-orange-600"
                        />
                        <p className="text-xs text-gray-500">Réservé</p>
                      </div>
                      <div>
                        <StatValue
                          value={
                            stock.available_display?.trim() ||
                            parseFloat(stock.available_quantity).toFixed(0)
                          }
                          color="text-green-600"
                        />
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
