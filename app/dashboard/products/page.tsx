"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    Download,
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
} from "lucide-react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
    getProducts,
    getCategories,
    getBrands,
    getUnits,
    deleteProduct,
    downloadImportTemplate,
    importProducts,
    Product,
    Category,
    Brand,
    ProductFilters,
    ImportResult,
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

    // Import dialog
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

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
    }, [session?.accessToken]);

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
    }, [session?.accessToken, organization]);

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
    }, [session?.accessToken, organization, currentPage, pageSize, searchQuery, selectedCategory, selectedBrand, selectedStatus]);

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

    // Handle download template
    const handleDownloadTemplate = async () => {
        if (!session?.accessToken || !organization?.id) return;

        setIsDownloadingTemplate(true);
        try {
            const result = await downloadImportTemplate(session.accessToken, organization.id);
            if (result && result.data) {
                // Convertir le tableau de nombres en Uint8Array puis en Blob
                const uint8Array = new Uint8Array(result.data);
                const blob = new Blob([uint8Array], { type: result.contentType });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'template_import_produits.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success("Template téléchargé avec succès");
            } else {
                toast.error("Erreur lors du téléchargement du template. Vérifiez vos permissions.");
            }
        } catch (error: any) {
            console.error("Download template error:", error);
            toast.error(error?.message || "Erreur lors du téléchargement du template");
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    // Handle import
    const handleImport = async () => {
        if (!session?.accessToken || !organization?.id || !importFile) return;

        setIsImporting(true);
        setImportResult(null);

        const result = await importProducts(session.accessToken, organization.id, importFile);

        if (result.success && result.data) {
            setImportResult(result.data);
            if (result.data.created > 0) {
                toast.success(`${result.data.created} produit(s) importé(s) avec succès`);
                fetchProducts();
            }
        } else {
            setImportResult(result.data || {
                success: false,
                error: result.message,
                created: 0,
                updated: 0,
                skipped: 0,
                errors: []
            });
        }

        setIsImporting(false);
    };

    // Reset import dialog
    const resetImportDialog = () => {
        setImportFile(null);
        setImportResult(null);
        setImportDialogOpen(false);
    };

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Produits</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {totalCount} produit{totalCount > 1 ? "s" : ""} au total
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadTemplate}
                        disabled={isDownloadingTemplate}
                    >
                        {isDownloadingTemplate ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4 mr-2" />
                        )}
                        Télécharger le Template Excel
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportDialogOpen(true)}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Importer les Produits
                    </Button>
                    <Link href="/dashboard/products/new">
                        <Button className="bg-orange-500 hover:bg-orange-600" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Nouveau produit
                        </Button>
                    </Link>
                </div>
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
                                    href={`/dashboard/products/${product.id}`}
                                    onDelete={() => {
                                        setProductToDelete(product);
                                        setDeleteDialogOpen(true);
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="p-2">
                            <div className="divide-y space-y-1">
                                {products.map((product) => (
                                    <ProductListItem
                                        key={product.id}
                                        product={product}
                                        formatPrice={formatPrice}
                                        onEdit={() => router.push(`/dashboard/products/${product.id}/edit`)}
                                        onView={() => router.push(`/dashboard/products/${product.id}`)}
                                        href={`/dashboard/products/${product.id}`}
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

            {/* Import Dialog */}
            <ImportDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                importFile={importFile}
                setImportFile={setImportFile}
                isImporting={isImporting}
                importResult={importResult}
                onImport={handleImport}
                onReset={resetImportDialog}
                onDownloadTemplate={handleDownloadTemplate}
                isDownloadingTemplate={isDownloadingTemplate}
            />
        </div>
    );
}

// Product Card Component
function ProductCard({
    product,
    formatPrice,
    onEdit,
    onView,
    href,
    onDelete,
}: {
    product: Product;
    formatPrice: (price: string | number) => string;
    onEdit: () => void;
    onView: () => void;
    href: string;
    onDelete: () => void;
}) {
    const stockQuantity = product.stock_quantity ?? 0;
    const isLowStock = product.track_inventory && stockQuantity <= product.reorder_point;

    return (
        <Link href={href}>
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
        </Link>
    );
}

// Import Dialog Component
function ImportDialog({
    open,
    onOpenChange,
    importFile,
    setImportFile,
    isImporting,
    importResult,
    onImport,
    onReset,
    onDownloadTemplate,
    isDownloadingTemplate,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    importFile: File | null;
    setImportFile: (file: File | null) => void;
    isImporting: boolean;
    importResult: ImportResult | null;
    onImport: () => void;
    onReset: () => void;
    onDownloadTemplate: () => void;
    isDownloadingTemplate: boolean;
}) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) onReset();
            else onOpenChange(isOpen);
        }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-orange-500" />
                        Importer des produits
                    </DialogTitle>
                    <DialogDescription>
                        Importez vos produits depuis un fichier Excel basé sur notre template.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!importResult ? (
                        <>
                            {/* Instructions */}
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm">
                                <p className="font-medium text-orange-800 mb-2">Instructions :</p>
                                <ol className="list-decimal list-inside space-y-1 text-orange-700">
                                    <li>Téléchargez le template Excel officiel</li>
                                    <li>Remplissez vos produits dans le fichier</li>
                                    <li>Ne modifiez pas les en-têtes ni la structure</li>
                                    <li>Importez le fichier complété ici</li>
                                </ol>
                            </div>

                            {/* Download template button */}
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={onDownloadTemplate}
                                disabled={isDownloadingTemplate}
                            >
                                {isDownloadingTemplate ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4 mr-2" />
                                )}
                                Télécharger le template Excel
                            </Button>

                            {/* File input */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Fichier Excel à importer
                                </label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                        id="import-file"
                                    />
                                    <label htmlFor="import-file" className="cursor-pointer">
                                        {importFile ? (
                                            <div className="flex items-center justify-center gap-2 text-green-600">
                                                <CheckCircle2 className="h-8 w-8" />
                                                <div className="text-left">
                                                    <p className="font-medium">{importFile.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {(importFile.size / 1024).toFixed(1)} Ko
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500">
                                                <Upload className="h-8 w-8 mx-auto mb-2" />
                                                <p>Cliquez pour sélectionner un fichier</p>
                                                <p className="text-xs">ou glissez-déposez ici</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Import Results */
                        <div className="space-y-4">
                            {importResult.success !== false ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                                        <CheckCircle2 className="h-5 w-5" />
                                        Importation terminée
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <StatValue value={String(importResult.created)} color="text-green-600" />
                                            <p className="text-xs text-gray-600">Créé(s)</p>
                                        </div>
                                        <div>
                                            <StatValue value={String(importResult.updated)} color="text-blue-600" />
                                            <p className="text-xs text-gray-600">Mis à jour</p>
                                        </div>
                                        <div>
                                            <StatValue value={String(importResult.skipped)} color="text-orange-600" />
                                            <p className="text-xs text-gray-600">Ignoré(s)</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                                        <XCircle className="h-5 w-5" />
                                        Erreur d&apos;importation
                                    </div>
                                    <p className="text-sm text-red-600">{importResult.error}</p>
                                </div>
                            )}

                            {/* Error details */}
                            {importResult.errors && importResult.errors.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b">
                                        <p className="font-medium text-sm">
                                            Erreurs détectées ({importResult.errors.length})
                                        </p>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {importResult.errors.map((err, idx) => (
                                            <div key={idx} className="px-4 py-2 border-b last:border-0 text-sm">
                                                <p className="font-medium text-gray-700">
                                                    Ligne {err.row}: {err.name}
                                                </p>
                                                <ul className="list-disc list-inside text-red-600 text-xs mt-1">
                                                    {err.errors.map((e, i) => (
                                                        <li key={i}>{e}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {!importResult ? (
                        <>
                            <Button variant="outline" onClick={onReset}>
                                Annuler
                            </Button>
                            <Button
                                onClick={onImport}
                                disabled={!importFile || isImporting}
                                className="bg-orange-500 hover:bg-orange-600"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Importation...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Importer
                                    </>
                                )}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={onReset} className="bg-orange-500 hover:bg-orange-600">
                            Fermer
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Product List Item Component
function ProductListItem({
    product,
    formatPrice,
    onEdit,
    onView,
    href,
    onDelete,
}: {
    product: Product;
    formatPrice: (price: string | number) => string;
    onEdit: () => void;
    onView: () => void;
    href: string;
    onDelete: () => void;
}) {
    const stockQuantity = product.stock_quantity ?? 0;
    const isLowStock = product.track_inventory && stockQuantity <= product.reorder_point;

    return (
        <Link href={href} className="flex items-center rounded-xl gap-4 hover:bg-gray-50">
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
        </Link>
    );
}
