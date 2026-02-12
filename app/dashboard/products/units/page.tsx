"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  Ruler,
} from "lucide-react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  Unit,
} from "@/actions/products.actions";

export default function UnitsPage() {
  const { data: session } = useSession();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

  // Form state
  const [formData, setFormData] = useState({ name: "", symbol: "" });
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
  }, [session]);

  // Fetch units
  const fetchUnits = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const result = await getUnits(session.accessToken, organization.id, {
      search: searchQuery || undefined,
    });

    if (result.success && result.data) {
      setUnits(result.data.results || []);
    }
    setIsLoading(false);
  }, [session, organization, searchQuery]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Open dialog for new unit
  const openNewDialog = () => {
    setEditingUnit(null);
    setFormData({ name: "", symbol: "" });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  // Open dialog for edit
  const openEditDialog = (unit: Unit) => {
    setEditingUnit(unit);
    setFormData({ name: unit.name, symbol: unit.symbol });
    setFormErrors({});
    setIsDialogOpen(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Le nom est requis";
    if (!formData.symbol.trim()) errors.symbol = "Le symbole est requis";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (!session?.accessToken || !organization?.id) return;

    setIsSaving(true);

    let result;
    if (editingUnit) {
      result = await updateUnit(session.accessToken, organization.id, editingUnit.id, {
        name: formData.name,
        symbol: formData.symbol,
      });
    } else {
      result = await createUnit(session.accessToken, organization.id, {
        name: formData.name,
        symbol: formData.symbol,
      });
    }

    if (result.success) {
      setIsDialogOpen(false);
      fetchUnits();
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
    if (!unitToDelete || !session?.accessToken || !organization?.id) return;

    setIsDeleting(true);
    const result = await deleteUnit(session.accessToken, organization.id, unitToDelete.id);

    if (result.success) {
      setIsDeleteDialogOpen(false);
      setUnitToDelete(null);
      fetchUnits();
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-row flex-wrap sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Unités de mesure</h1>
            <p className="text-sm text-gray-500">
              {units.length} unité{units.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={openNewDialog} className="w-full bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle unité
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Rechercher une unité..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Units List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : units.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Ruler className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune unité</h3>
            <p className="text-sm text-gray-500 text-center mb-4">
              Créez des unités de mesure pour vos produits.
            </p>
            <Button onClick={openNewDialog} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              Créer une unité
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-sm">{unit.symbol}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{unit.name}</h3>
                    <p className="text-sm text-gray-500">Symbole: {unit.symbol}</p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(unit)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setUnitToDelete(unit);
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
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? "Modifier l'unité" : "Nouvelle unité"}
            </DialogTitle>
            <DialogDescription>
              {editingUnit
                ? "Modifiez les informations de l'unité."
                : "Créez une nouvelle unité de mesure."}
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
                placeholder="Ex: Kilogramme"
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && <p className="text-sm text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="symbol">Symbole *</Label>
              <Input
                id="symbol"
                value={formData.symbol}
                onChange={(e) => setFormData((prev) => ({ ...prev, symbol: e.target.value }))}
                placeholder="Ex: kg"
                maxLength={10}
                className={formErrors.symbol ? "border-red-500" : ""}
              />
              {formErrors.symbol && <p className="text-sm text-red-500">{formErrors.symbol}</p>}
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
                    {editingUnit ? "Modification..." : "Création..."}
                  </>
                ) : editingUnit ? (
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
            <AlertDialogTitle>Supprimer cette unité ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{unitToDelete?.name}</strong> ?
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
