"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Package,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    Loader2,
    AlertTriangle,
    Grid3X3,
    List,
    ChevronLeft,
    ChevronRight,
    Barcode,
    Tag,
    X,
    FolderTree,
    Ruler,
} from "lucide-react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
    getProducts,
    getCategories,
    getBrands,
    getUnits,
    deleteProduct,
    Product,
    Category,
    Brand,
    ProductFilters,
} from "@/actions/products.actions";
import { cn } from "@/lib/utils";
import { DataPagination } from "@/components/shared/DataPagination";

export default function ProductsPage() {
    const { data: session } = useSession();
    const router = useRouter();

    // State
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [categoriesCount, setCategoriesCount] = useState(0);
    const [brandsCount, setBrandsCount] = useState(0);
    const [unitsCount, setUnitsCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [selectedBrand, setSelectedBrand] = useState<string>("all");
    const [selectedStatus, setSelectedStatus] = useState<string>("all");
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [pageSize] = useState(12);

    // View mode - list by default (mobile), grid on large screens
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");

    useEffect(() => {
        const mql = window.matchMedia("(min-width: 1024px)");
        if (mql.matches) setViewMode("grid");
    }, []);

    // Delete dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch organization
    useEffect(() => {
        async function fetchOrganization() {
            if (session?.accessToken) {
                const result = await getUserOrganizations(session.accessToken);
                if (result.success && result.data && result.data.length > 0) {
                    setOrganization(result.data[0]);
                }
            }
        }
        fetchOrganization();
    }, [session]);

    // Fetch categories, brands and units counts
    useEffect(() => {
        async function fetchFiltersData() {
            if (!session?.accessToken || !organization?.id) return;

            const [categoriesResult, brandsResult, unitsResult] = await Promise.all([
                getCategories(session.accessToken, organization.id),
                getBrands(session.accessToken, organization.id),
                getUnits(session.accessToken, organization.id),
            ]);

            if (categoriesResult.success && categoriesResult.data) {
                setCategories(categoriesResult.data.results || []);
                setCategoriesCount(categoriesResult.data.count || 0);
            }
            if (brandsResult.success && brandsResult.data) {
                setBrands(brandsResult.data.results || []);
                setBrandsCount(brandsResult.data.count || 0);
            }
            if (unitsResult.success && unitsResult.data) {
                setUnitsCount(unitsResult.data.count || 0);
            }
        }
        fetchFiltersData();
    }, [session, organization]);

    // Fetch products
    const fetchProducts = useCallback(async () => {
        if (!session?.accessToken || !organization?.id) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const filters: ProductFilters = {
            page: currentPage,
            page_size: pageSize,
        };

        if (searchQuery) filters.search = searchQuery;
        if (selectedCategory && selectedCategory !== "all") filters.category = selectedCategory;
        if (selectedBrand && selectedBrand !== "all") filters.brand = selectedBrand;
        if (selectedStatus === "active") filters.is_active = true;
        if (selectedStatus === "inactive") filters.is_active = false;

        const result = await getProducts(session.accessToken, organization.id, filters);

        if (result.success && result.data) {
            setProducts(result.data.results || []);
            setTotalCount(result.data.count || 0);
            setHasNext(result.data.next !== null);
            setHasPrevious(result.data.previous !== null);
        } else {
            setError(result.message || "Erreur lors du chargement des produits");
        }

        setIsLoading(false);
    }, [session, organization, currentPage, pageSize, searchQuery, selectedCategory, selectedBrand, selectedStatus]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // Handle search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Handle delete
    const handleDelete = async () => {
        if (!productToDelete || !session?.accessToken || !organization?.id) return;

        setIsDeleting(true);
        const result = await deleteProduct(session.accessToken, organization.id, productToDelete.id);

        if (result.success) {
            fetchProducts();
            setDeleteDialogOpen(false);
            setProductToDelete(null);
        } else {
            setError(result.message || "Erreur lors de la suppression");
        }
        setIsDeleting(false);
    };

    // Clear filters
    const clearFilters = () => {
        setSearchQuery("");
        setSelectedCategory("all");
        setSelectedBrand("all");
        setSelectedStatus("all");
        setCurrentPage(1);
    };

    const hasActiveFilters = searchQuery || selectedCategory !== "all" || selectedBrand !== "all" || selectedStatus !== "all";
    const activeFilterCount = [selectedCategory !== "all", selectedBrand !== "all", selectedStatus !== "all"].filter(Boolean).length;


    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Produits</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {totalCount} produit{totalCount > 1 ? "s" : ""} au total
                    </p>
                </div>
                <Link href="/dashboard/products/new">
                    <Button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600">
                        <Plus className="h-4 w-4 mr-2" />
                        Nouveau produit
                    </Button>
                </Link>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/products/categories">
                    <Button variant="outline" size="sm" className="gap-2">
                        <FolderTree className="h-4 w-4" />
                        Catégories
                        {categoriesCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded">
                                {categoriesCount}
                            </span>
                        )}
                    </Button>
                </Link>
                <Link href="/dashboard/products/brands">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Tag className="h-4 w-4" />
                        Marques
                        {brandsCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded">
                                {brandsCount}
                            </span>
                        )}
                    </Button>
                </Link>
                <Link href="/dashboard/products/units">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Ruler className="h-4 w-4" />
                        Unités
                        {unitsCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded">
                                {unitsCount}
                            </span>
                        )}
                    </Button>
                </Link>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="search"
                            placeholder="Rechercher par nom, SKU ou code-barres..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Popover open={showFilters} onOpenChange={setShowFilters}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "gap-2 shrink-0",
                                    (showFilters || activeFilterCount > 0) && "bg-orange-50 border-orange-200 text-orange-700"
                                )}
                            >
                                <Filter className="h-4 w-4" />
                                <span className="hidden sm:inline">Filtres</span>
                                {activeFilterCount > 0 && (
                                    <span className="bg-orange-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm text-gray-900">Filtrer les produits</h4>
                                    {hasActiveFilters && (
                                        <button
                                            onClick={clearFilters}
                                            className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                                        >
                                            Réinitialiser
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500">Catégorie</label>
                                        <SearchableSelect
                                            options={[
                                                { value: "all", label: "Toutes les catégories" },
                                                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
                                            ]}
                                            value={selectedCategory}
                                            onValueChange={setSelectedCategory}
                                            placeholder="Catégorie"
                                            searchPlaceholder="Rechercher une catégorie..."
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500">Marque</label>
                                        <SearchableSelect
                                            options={[
                                                { value: "all", label: "Toutes les marques" },
                                                ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
                                            ]}
                                            value={selectedBrand}
                                            onValueChange={setSelectedBrand}
                                            placeholder="Marque"
                                            searchPlaceholder="Rechercher une marque..."
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500">Statut</label>
                                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Statut" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tous les statuts</SelectItem>
                                                <SelectItem value="active">Actif</SelectItem>
                                                <SelectItem value="inactive">Inactif</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="hidden sm:flex border rounded-lg">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode("grid")}
                            className={cn("rounded-r-none", viewMode === "grid" && "bg-gray-100")}
                        >
                            <Grid3X3 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode("list")}
                            className={cn("rounded-l-none", viewMode === "list" && "bg-gray-100")}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Active filter badges */}
                {activeFilterCount > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {selectedCategory !== "all" && (
                            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 bg-orange-50 text-orange-700 border border-orange-200">
                                {categories.find(c => c.id === selectedCategory)?.name}
                                <button onClick={() => setSelectedCategory("all")} className="ml-1 hover:bg-orange-200 rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {selectedBrand !== "all" && (
                            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 bg-orange-50 text-orange-700 border border-orange-200">
                                {brands.find(b => b.id === selectedBrand)?.name}
                                <button onClick={() => setSelectedBrand("all")} className="ml-1 hover:bg-orange-200 rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {selectedStatus !== "all" && (
                            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 bg-orange-50 text-orange-700 border border-orange-200">
                                {selectedStatus === "active" ? "Actif" : "Inactif"}
                                <button onClick={() => setSelectedStatus("all")} className="ml-1 hover:bg-orange-200 rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {/* Loading state */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                </div>
            ) : products.length === 0 ? (
                /* Empty state */
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Package className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun produit trouvé</h3>
                        <p className="text-sm text-gray-500 text-center mb-4">
                            {hasActiveFilters
                                ? "Aucun produit ne correspond à vos critères de recherche."
                                : "Commencez par ajouter votre premier produit."}
                        </p>
                        {hasActiveFilters ? (
                            <Button variant="outline" onClick={clearFilters}>
                                Effacer les filtres
                            </Button>
                        ) : (
                            <Link href="/dashboard/products/new">
                                <Button className="bg-orange-500 hover:bg-orange-600">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Ajouter un produit
                                </Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Products Grid/List */}
                    {viewMode === "grid" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {products.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    formatPrice={formatPrice}
                                    onEdit={() => router.push(`/dashboard/products/${product.id}/edit`)}
                                    onView={() => router.push(`/dashboard/products/${product.id}`)}
                                    onDelete={() => {
                                        setProductToDelete(product);
                                        setDeleteDialogOpen(true);
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="p-2">
                            <div className="divide-y">
                                {products.map((product) => (
                                    <ProductListItem
                                        key={product.id}
                                        product={product}
                                        formatPrice={formatPrice}
                                        onEdit={() => router.push(`/dashboard/products/${product.id}/edit`)}
                                        onView={() => router.push(`/dashboard/products/${product.id}`)}
                                        onDelete={() => {
                                            setProductToDelete(product);
                                            setDeleteDialogOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                        </Card>
                    )}

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
                </>
            )}

            {/* Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer <strong>{productToDelete?.name}</strong> ?
                            Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Suppression...
                                </>
                            ) : (
                                "Supprimer"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Product Card Component
function ProductCard({
    product,
    formatPrice,
    onEdit,
    onView,
    onDelete,
}: {
    product: Product;
    formatPrice: (price: string | number) => string;
    onEdit: () => void;
    onView: () => void;
    onDelete: () => void;
}) {
    const stockQuantity = product.stock_quantity ?? 0;
    const isLowStock = product.track_inventory && stockQuantity <= product.reorder_point;

    return (
        <Card className="overflow-hidden hover:shadow-md transition-shadow gap-0 p-0">
            {/* Product Image */}
            <div className="aspect-square h-32 bg-gray-100 relative">
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-12 w-12 text-gray-300" />
                    </div>
                )}
                {/* Status badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {!product.is_active && (
                        <Badge variant="secondary" className="text-xs">
                            Inactif
                        </Badge>
                    )}
                    {product.is_featured && (
                        <Badge className="bg-orange-500 text-xs">
                            Vedette
                        </Badge>
                    )}
                    {isLowStock && (
                        <Badge variant="destructive" className="text-xs">
                            Stock bas
                        </Badge>
                    )}
                </div>
                {/* Actions menu */}
                <div className="absolute top-2 right-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onView}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onEdit}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onDelete} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Product Info */}
            <CardContent className="p-4">
                <div className="space-y-2">
                    <div>
                        <h3 className="font-medium text-gray-900 line-clamp-1">{product.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Barcode className="h-3 w-3" />
                            <span>{product.sku}</span>
                        </div>
                    </div>

                    {product.category_name && (
                        <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{product.category_name}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                        <div>
                            <p className="text-lg font-bold text-orange-600">
                                {formatPrice(product.selling_price)}
                            </p>
                            {product.track_inventory && (
                                <p className={cn(
                                    "text-xs",
                                    isLowStock ? "text-red-500" : "text-gray-500"
                                )}>
                                    Stock: {stockQuantity} {product.unit_symbol || ""}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Product List Item Component
function ProductListItem({
    product,
    formatPrice,
    onEdit,
    onView,
    onDelete,
}: {
    product: Product;
    formatPrice: (price: string | number) => string;
    onEdit: () => void;
    onView: () => void;
    onDelete: () => void;
}) {
    const stockQuantity = product.stock_quantity ?? 0;
    const isLowStock = product.track_inventory && stockQuantity <= product.reorder_point;

    return (
        <div className="flex items-center rounded-xl gap-4 hover:bg-gray-50">
            {/* Image */}
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-300" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                    {!product.is_active && (
                        <Badge variant="secondary" className="text-xs">Inactif</Badge>
                    )}
                    {isLowStock && (
                        <Badge variant="destructive" className="text-xs">Stock bas</Badge>
                    )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span>{product.sku}</span>
                    {product.category_name && <span>{product.category_name}</span>}
                    <span>{product.brand_name}</span>
                    <span>
                        {product.stock_quantity}  <span>{product.unit_symbol}</span>
                    </span>
                    <span>{product.reorder_point}</span>
                </div>
            </div>

            {/* Price & Stock */}
            <div className="text-right hidden sm:block">
                <p className="font-bold text-orange-600">{formatPrice(product.selling_price)}</p>
                {product.track_inventory && (
                    <p className={cn("text-sm", isLowStock ? "text-red-500" : "text-gray-500")}>
                        Stock: {stockQuantity}
                    </p>
                )}
            </div>

            {/* Actions */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onView}>
                        <Eye className="h-4 w-4 mr-2" />
                        Voir
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
