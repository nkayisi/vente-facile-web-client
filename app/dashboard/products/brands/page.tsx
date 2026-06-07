"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Tag,
} from "lucide-react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  Brand,
  BrandFilters,
} from "@/actions/products.actions";
import { DataPagination } from "@/components/shared/DataPagination";
import { ProductsDataTable, type DataTableColumn } from "@/components/shared/ProductsDataTable";

export default function BrandsPage() {
  const { data: session } = useSession();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);

  // Form state
  const [formData, setFormData] = useState({ name: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
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
  }, [session?.accessToken]);

  // Fetch brands
  const fetchBrands = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const filters: BrandFilters = {
      search: searchQuery || undefined,
      page: currentPage,
      page_size: pageSize,
    };
    const result = await getBrands(session.accessToken, organization.id, filters);

    if (result.success && result.data) {
      setBrands(result.data.results || []);
      setTotalCount(result.data.count || 0);
      setHasNext(result.data.next !== null);
      setHasPrevious(result.data.previous !== null);
    }
    setIsLoading(false);
  }, [session?.accessToken, organization, searchQuery, currentPage, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  // Open dialog for new brand
  const openNewDialog = () => {
    setEditingBrand(null);
    setFormData({ name: "" });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  // Open dialog for edit
  const openEditDialog = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({ name: brand.name });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const brandColumns: DataTableColumn<Brand>[] = [
    {
      id: "name",
      header: "Marque",
      className: "min-w-[200px]",
      cell: (brand) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground">{brand.name}</span>
          <span className="truncate text-xs text-muted-foreground">{brand.slug}</span>
        </div>
      ),
    },
    {
      id: "products",
      header: "Produits",
      className: "text-right tabular-nums",
      cell: (brand) => (
        <span className="tabular-nums text-muted-foreground">{brand.products_count ?? 0}</span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      cell: (brand) => (
        <Badge variant={brand.is_active ? "default" : "secondary"}>
          {brand.is_active ? "Actif" : "Inactif"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-[52px] text-right",
      cell: (brand) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              aria-label={`Actions pour ${brand.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(brand)}>
              <Edit className="h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={() => {
                setBrandToDelete(brand);
                setIsDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setFormErrors({ name: "Le nom est requis" });
      return;
    }

    if (!session?.accessToken || !organization?.id) return;

    setIsSaving(true);

    let result;
    if (editingBrand) {
      result = await updateBrand(session.accessToken, organization.id, editingBrand.id, {
        name: formData.name,
      });
    } else {
      result = await createBrand(session.accessToken, organization.id, {
        name: formData.name,
      });
    }

    if (result.success) {
      setIsDialogOpen(false);
      fetchBrands();
    } else {
      // Gérer les erreurs de validation par champ
      if (result.errors) {
        const newErrors: any = {};
        Object.keys(result.errors).forEach((key) => {
          const errorValue = result.errors![key];
          if (Array.isArray(errorValue)) {
            newErrors[key] = errorValue[0];
          } else if (typeof errorValue === 'string') {
            newErrors[key] = errorValue;
          }
        });
        setFormErrors(newErrors);
      } else {
        setFormErrors({ general: result.message || "Une erreur est survenue" });
      }
    }

    setIsSaving(false);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!brandToDelete || !session?.accessToken || !organization?.id) return;

    setIsDeleting(true);
    const result = await deleteBrand(session.accessToken, organization.id, brandToDelete.id);

    if (result.success) {
      setIsDeleteDialogOpen(false);
      setBrandToDelete(null);
      fetchBrands();
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-balance text-xl lg:text-2xl font-bold text-gray-900">Marques</h1>
            <p className="text-sm text-gray-500">
              {totalCount} marque{totalCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={openNewDialog} className="max-w-max sm:w-auto bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle marque
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Rechercher une marque..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ProductsDataTable<Brand>
        columns={brandColumns}
        data={brands}
        isLoading={isLoading}
        emptyMessage="Aucune marque"
        emptyDescription="Créez des marques pour identifier vos produits."
        emptyIcon={<Tag className="h-8 w-8" />}
        emptyAction={
          <Button onClick={openNewDialog} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4" data-icon="inline-start" />
            Créer une marque
          </Button>
        }
        tableFooter={
          !isLoading && brands.length > 0 && totalPages > 1 ? (
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? "Modifier la marque" : "Nouvelle marque"}
            </DialogTitle>
            <DialogDescription>
              {editingBrand
                ? "Modifiez le nom de la marque."
                : "Créez une nouvelle marque pour vos produits."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formErrors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{formErrors.general}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="Ex: Coca-Cola"
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
            </div>

            <DialogFooter className="w-full flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-orange-500 hover:bg-orange-600">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingBrand ? "Modification..." : "Création..."}
                  </>
                ) : editingBrand ? (
                  "Modifier"
                ) : (
                  "Créer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette marque ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{brandToDelete?.name}</strong> ?
              {(brandToDelete?.products_count || 0) > 0 && (
                <span className="block mt-2 text-orange-600">
                  Attention : {brandToDelete?.products_count} produit(s) sont associés à cette marque.
                </span>
              )}
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
