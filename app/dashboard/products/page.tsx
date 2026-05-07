"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { StatValue } from "@/components/shared/StatValue";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { formatApiErrorBody } from "@/lib/api/drf-error";
import { cn } from "@/lib/utils";
import { DataPagination } from "@/components/shared/DataPagination";
import { ProductsDataTable, type DataTableColumn } from "@/components/shared/ProductsDataTable";

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
    const [pageSize] = useState(20);

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
            full_catalog: true,
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
        } catch (error: unknown) {
            console.error("Download template error:", error);
            const message = error instanceof Error ? error.message : "Erreur lors du téléchargement du template";
            toast.error(message);
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
            const msg = result.message || "Erreur lors de l'importation";
            toast.error(msg);
            const data = result.data;
            if (data) {
                const errorDisplay =
                    typeof data.error === "string"
                        ? data.error
                        : data.error != null
                          ? formatApiErrorBody(
                                { error: data.error, detail: data.error } as Record<string, unknown>,
                                msg
                            )
                          : msg;
                setImportResult({
                    ...data,
                    success: false,
                    error: errorDisplay,
                });
            } else {
                setImportResult({
                    success: false,
                    error: msg,
                    created: 0,
                    updated: 0,
                    skipped: 0,
                    errors: [],
                });
            }
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

    const productColumns = useMemo<DataTableColumn<Product>[]>(
        () => [
            {
                id: "product",
                header: "Produit",
                className: "min-w-[220px]",
                cell: (product) => (
                    <div className="flex items-center gap-3">
                        <Avatar className="size-9 shrink-0 rounded-md">
                            {product.image ? (
                                <AvatarImage
                                    src={product.image}
                                    alt=""
                                    className="rounded-md object-cover ring-1 ring-black/10 dark:ring-white/10"
                                />
                            ) : null}
                            <AvatarFallback className="rounded-md">
                                <Package />
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <Link
                                href={`/dashboard/products/${product.id}`}
                                className="truncate font-medium text-foreground hover:underline"
                            >
                                {product.name}
                            </Link>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Barcode className="h-3 w-3 shrink-0 opacity-70" />
                                <span className="truncate tabular-nums">{product.sku}</span>
                            </div>
                        </div>
                    </div>
                ),
            },
            {
                id: "category",
                header: "Catégorie",
                className: "min-w-[120px]",
                cell: (product) => (
                    <span className="text-muted-foreground">{product.category_name?.trim() || "—"}</span>
                ),
            },
            {
                id: "brand",
                header: "Marque",
                className: "min-w-[100px]",
                cell: (product) => (
                    <span className="text-muted-foreground">{product.brand_name?.trim() || "—"}</span>
                ),
            },
            {
                id: "price",
                header: "Prix",
                className: "text-right tabular-nums",
                cell: (product) => (
                    <div className="flex flex-col items-end gap-0.5 tabular-nums">
                        <span className="font-medium text-foreground">{formatPrice(product.selling_price)}</span>
                        <span className="text-xs text-muted-foreground">{formatPrice(product.cost_price)}</span>
                    </div>
                ),
            },
            {
                id: "stock",
                header: "Stock",
                className: "text-right tabular-nums",
                cell: (product) => (
                    <span className="tabular-nums text-muted-foreground">
                        {product.track_inventory ? (
                            <>
                                {product.stock_quantity ?? 0}
                                {product.unit_symbol ? ` ${product.unit_symbol}` : ""}
                            </>
                        ) : (
                            "—"
                        )}
                    </span>
                ),
            },
            {
                id: "status",
                header: "Statut",
                cell: (product) => (
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Actif" : "Inactif"}
                    </Badge>
                ),
            },
            {
                id: "actions",
                header: <span className="sr-only">Actions</span>,
                className: "w-[52px] text-right",
                cell: (product) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-10 shrink-0"
                                aria-label={`Actions pour ${product.name}`}
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                className="gap-2"
                                onClick={() => router.push(`/dashboard/products/${product.id}`)}
                            >
                                <Eye className="h-4 w-4" />
                                Voir
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="gap-2"
                                onClick={() => router.push(`/dashboard/products/${product.id}/edit`)}
                            >
                                <Edit className="h-4 w-4" />
                                Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => {
                                    setProductToDelete(product);
                                    setDeleteDialogOpen(true);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
        ],
        [router]
    );

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-balance text-xl lg:text-2xl font-bold text-gray-900">Produits</h1>
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
                <div className="flex justify-between gap-2">
                    <div className="relative flex-1 max-w-sm">
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
                    <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <ProductsDataTable<Product>
                columns={productColumns}
                data={products}
                isLoading={isLoading}
                emptyMessage={hasActiveFilters ? "Aucun produit trouvé" : "Aucun produit"}
                emptyDescription={
                    hasActiveFilters
                        ? "Aucun produit ne correspond à vos critères de recherche."
                        : "Commencez par ajouter votre premier produit."
                }
                emptyIcon={<Package className="h-8 w-8" />}
                emptyAction={
                    hasActiveFilters ? (
                        <Button variant="outline" onClick={clearFilters}>
                            Effacer les filtres
                        </Button>
                    ) : (
                        <Link href="/dashboard/products/new">
                            <Button className="bg-orange-500 hover:bg-orange-600">
                                <Plus className="h-4 w-4" data-icon="inline-start" />
                                Ajouter un produit
                            </Button>
                        </Link>
                    )
                }
                tableFooter={
                    !isLoading && products.length > 0 && totalPages > 1 ? (
                        <DataPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            hasNext={hasNext}
                            hasPrevious={hasPrevious}
                        />
                    ) : null
                }
            />

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
                                    <p className="text-sm text-red-600">
                                        {typeof importResult.error === "string"
                                            ? importResult.error
                                            : importResult.error
                                              ? formatApiErrorBody(
                                                    importResult.error as Record<string, unknown>,
                                                    "Erreur d'importation"
                                                )
                                              : "Erreur d'importation"}
                                    </p>
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
