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
import { SearchableSelect } from "@/components/ui/searchable-select";
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
  FolderTree,
} from "lucide-react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  Category,
  CategoryFilters,
} from "@/actions/products.actions";
import { DataPagination } from "@/components/shared/DataPagination";
import { ProductsDataTable, type DataTableColumn } from "@/components/shared/ProductsDataTable";

export default function CategoriesPage() {
  const { data: session } = useSession();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parent: null as string | null,
  });
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

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const filters: CategoryFilters = {
      search: searchQuery || undefined,
      page: currentPage,
      page_size: pageSize,
    };
    const result = await getCategories(session.accessToken, organization.id, filters);

    if (result.success && result.data) {
      setCategories(result.data.results || []);
      setTotalCount(result.data.count || 0);
      setHasNext(result.data.next !== null);
      setHasPrevious(result.data.previous !== null);
    }
    setIsLoading(false);
  }, [session?.accessToken, organization, searchQuery, currentPage, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Open dialog for new category
  const openNewDialog = () => {
    setEditingCategory(null);
    setFormData({ name: "", description: "", parent: null });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  // Open dialog for edit
  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      parent: category.parent || null,
    });
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
    if (editingCategory) {
      result = await updateCategory(session.accessToken, organization.id, editingCategory.id, {
        name: formData.name,
        description: formData.description,
        parent: formData.parent,
      });
    } else {
      result = await createCategory(session.accessToken, organization.id, {
        name: formData.name,
        description: formData.description,
        parent: formData.parent,
      });
    }

    if (result.success) {
      setIsDialogOpen(false);
      fetchCategories();
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
    if (!categoryToDelete || !session?.accessToken || !organization?.id) return;

    setIsDeleting(true);
    const result = await deleteCategory(session.accessToken, organization.id, categoryToDelete.id);

    if (result.success) {
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
    }
    setIsDeleting(false);
  };

  // Get parent categories (exclude current category and its children)
  const getParentOptions = () => {
    if (!editingCategory) return categories;
    return categories.filter((cat) => cat.id !== editingCategory.id);
  };

  // Get category name by ID
  const getCategoryName = (id: string | null) => {
    if (!id) return null;
    const cat = categories.find((c) => c.id === id);
    return cat?.name || null;
  };

  const categoryColumns: DataTableColumn<Category>[] = [
    {
      id: "name",
      header: "Nom",
      className: "min-w-[200px]",
      cell: (category) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground">{category.name}</span>
          {category.description ? (
            <span className="truncate text-xs text-muted-foreground">{category.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "parent",
      header: "Catégorie parente",
      cell: (category) => (
        <span className="text-muted-foreground">
          {category.parent_name?.trim() ||
            (category.parent ? getCategoryName(category.parent) : null) ||
            "—"}
        </span>
      ),
    },
    {
      id: "products",
      header: "Produits",
      className: "text-right tabular-nums",
      cell: (category) => (
        <span className="tabular-nums text-muted-foreground">{category.products_count ?? 0}</span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      cell: (category) => (
        <Badge variant={category.is_active ? "default" : "secondary"}>
          {category.is_active ? "Actif" : "Inactif"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "w-[52px] text-right",
      cell: (category) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              aria-label={`Actions pour ${category.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(category)}>
              <Edit className="h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={() => {
                setCategoryToDelete(category);
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
            <h1 className="text-balance text-xl lg:text-2xl font-bold text-gray-900">Catégories</h1>
            <p className="text-sm text-gray-500">
              {totalCount} catégorie{totalCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={openNewDialog} className="max-w-max sm:w-auto bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle catégorie
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Rechercher une catégorie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ProductsDataTable<Category>
        columns={categoryColumns}
        data={categories}
        isLoading={isLoading}
        emptyMessage="Aucune catégorie"
        emptyDescription="Créez des catégories pour organiser vos produits."
        emptyIcon={<FolderTree className="h-8 w-8" />}
        emptyAction={
          <Button onClick={openNewDialog} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4" data-icon="inline-start" />
            Créer une catégorie
          </Button>
        }
        tableFooter={
          !isLoading && categories.length > 0 && totalPages > 1 ? (
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
              {editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Modifiez les informations de la catégorie."
                : "Créez une nouvelle catégorie pour organiser vos produits."}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Boissons"
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
            </div>

            <div className="w-full space-y-2">
              <Label htmlFor="parent">Catégorie parente</Label>
              <SearchableSelect
                options={[
                  { value: "none", label: "Aucune (catégorie racine)" },
                  ...getParentOptions().map((cat) => ({ value: cat.id, label: cat.name })),
                ]}
                value={formData.parent || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, parent: value === "none" ? null : value }))
                }
                placeholder="Aucune (catégorie racine)"
                searchPlaceholder="Rechercher une catégorie..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Description optionnelle"
              />
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
                    {editingCategory ? "Modification..." : "Création..."}
                  </>
                ) : editingCategory ? (
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
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{categoryToDelete?.name}</strong> ?
              {(categoryToDelete?.products_count || 0) > 0 && (
                <span className="block mt-2 text-orange-600">
                  Attention : {categoryToDelete?.products_count} produit(s) sont associés à cette catégorie.
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
