"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  Package,
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
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Marques</h1>
            <p className="text-sm text-gray-500">
              {brands.length} marque{brands.length > 1 ? "s" : ""}
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

      {/* Brands List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Tag className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune marque</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Créez des marques pour identifier vos produits.
            </p>
            <Button onClick={openNewDialog} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Créer une marque
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Tag className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">{brand.name}</h3>
                      {!brand.is_active && (
                        <Badge variant="secondary" className="text-xs">Inactif</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {brand.products_count || 0} produit{(brand.products_count || 0) > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(brand)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setBrandToDelete(brand);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
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
        </Card>
      )}

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
