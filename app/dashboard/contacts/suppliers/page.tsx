"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Truck,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Mail,
  User,
  Filter,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  Supplier,
  CreateSupplierData,
  PaginatedResponse,
} from "@/actions/contacts.actions";
import { DataPagination } from "@/components/shared/DataPagination";

const CURRENCIES = ["CDF", "USD", "EUR"];

export default function SuppliersPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const pageSize = 20;

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateSupplierData>({
    name: "",
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    tax_id: "",
    currency: "USD",
    bank_name: "",
    bank_account: "",
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch organization on mount
  useEffect(() => {
    const fetchOrg = async () => {
      if (!session?.accessToken) return;
      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          setOrganization(orgResult.data[0]);
        }
      } catch (error) {
        toast.error("Erreur lors du chargement");
      }
    };
    fetchOrg();
  }, [session]);

  // Fetch suppliers with pagination
  const fetchSuppliers = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const filters: any = { page: currentPage, page_size: pageSize };
      if (statusFilter === "active") filters.is_active = true;
      if (statusFilter === "inactive") filters.is_active = false;
      if (searchQuery) filters.search = searchQuery;

      const result = await getSuppliers(session.accessToken, organization.id, filters);
      if (result.success && result.data) {
        setSuppliers(result.data.results || []);
        setTotalCount(result.data.count || 0);
        setHasNext(result.data.next !== null);
        setHasPrevious(result.data.previous !== null);
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des fournisseurs");
    } finally {
      setIsLoading(false);
    }
  }, [session, organization, currentPage, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    if (organization) {
      fetchSuppliers();
    }
  }, [organization, fetchSuppliers]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const resetForm = () => {
    setFormData({
      name: "",
      company_name: "",
      contact_person: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      tax_id: "",
      currency: "USD",
      bank_name: "",
      bank_account: "",
      is_active: true,
    });
    setFormErrors({});
  };

  const openCreateDialog = () => {
    setSelectedSupplier(null);
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      company_name: supplier.company_name || "",
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      website: supplier.website || "",
      address: supplier.address || "",
      tax_id: supplier.tax_id || "",
      currency: supplier.currency || "USD",
      bank_name: supplier.bank_name || "",
      bank_account: supplier.bank_account || "",
      is_active: supplier.is_active,
    });
    setFormErrors({});
    setShowCreateDialog(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Le nom est obligatoire";
    if (!formData.phone?.trim()) {
      errors.phone = "Le téléphone est obligatoire";
    } else if (!/^[\d+\-\s()]{6,20}$/.test(formData.phone)) {
      errors.phone = "Numéro de téléphone invalide";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Email invalide";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization) return;
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (selectedSupplier) {
        const result = await updateSupplier(
          session.accessToken,
          organization.id,
          selectedSupplier.id,
          formData
        );
        if (result.success && result.data) {
          toast.success("Fournisseur mis à jour avec succès");
          setSuppliers(prev =>
            prev.map(s => (s.id === selectedSupplier.id ? { ...s, ...result.data! } : s))
          );
          setShowCreateDialog(false);
        } else {
          toast.error(result.message || "Erreur lors de la mise à jour");
          if (result.errors) {
            const fieldErrors: Record<string, string> = {};
            Object.entries(result.errors).forEach(([key, val]) => {
              fieldErrors[key] = Array.isArray(val) ? val.join(", ") : String(val);
            });
            setFormErrors(fieldErrors);
          }
        }
      } else {
        const result = await createSupplier(session.accessToken, organization.id, formData);
        if (result.success && result.data) {
          toast.success("Fournisseur créé avec succès");
          setSuppliers(prev => [result.data!, ...prev]);
          setShowCreateDialog(false);
        } else {
          toast.error(result.message || "Erreur lors de la création");
          if (result.errors) {
            const fieldErrors: Record<string, string> = {};
            Object.entries(result.errors).forEach(([key, val]) => {
              fieldErrors[key] = Array.isArray(val) ? val.join(", ") : String(val);
            });
            setFormErrors(fieldErrors);
          }
        }
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.accessToken || !organization || !selectedSupplier) return;

    setIsSubmitting(true);
    try {
      const result = await deleteSupplier(
        session.accessToken,
        organization.id,
        selectedSupplier.id
      );
      if (result.success) {
        toast.success("Fournisseur supprimé avec succès");
        setSuppliers(prev => prev.filter(s => s.id !== selectedSupplier.id));
        setShowDeleteDialog(false);
        setSelectedSupplier(null);
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/contacts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fournisseurs</h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalCount} fournisseur{totalCount > 1 ? "s" : ""} enregistré{totalCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau fournisseur
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom, code, téléphone, contact..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Suppliers List */}
      {suppliers.length === 0 ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun fournisseur trouvé</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Essayez de modifier vos filtres"
                : "Créez votre premier fournisseur pour commencer"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4 mr-2" />
                Créer un fournisseur
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {suppliers.map((supplier: Supplier) => (
            <Card key={supplier.id} className="p-0 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="p-3 rounded-lg flex-shrink-0 bg-purple-100">
                    <Truck className="h-5 w-5 text-purple-600" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{supplier.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {supplier.code}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {supplier.currency}
                      </Badge>
                      {!supplier.is_active && (
                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                          Inactif
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      {supplier.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {supplier.contact_person}
                        </span>
                      )}
                      {supplier.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {supplier.phone}
                        </span>
                      )}
                      {supplier.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {supplier.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right hidden sm:block">
                    {parseFloat(supplier.current_balance) !== 0 && (
                      <div>
                        <p className="text-sm font-semibold text-orange-600">
                          {formatPrice(supplier.current_balance)}
                        </p>
                        <p className="text-xs text-gray-500">Solde</p>
                      </div>
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
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/contacts/suppliers/${supplier.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Voir détails
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setShowDeleteDialog(true);
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}

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
        </div>
      )}

      {/* Create/Edit Supplier Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSupplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}
            </DialogTitle>
            <DialogDescription>
              {selectedSupplier
                ? "Modifiez les informations du fournisseur"
                : "Enregistrez un nouveau fournisseur"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name + Company */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du fournisseur *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Congo Import SARL"
                />
                {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Raison sociale</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Raison sociale complète"
                />
              </div>
            </div>

            {/* Contact person + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Personne de contact</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Nom du contact principal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+243 XXX XXX XXX"
                />
                {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
              </div>
            </div>

            {/* Email + Website */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@fournisseur.com"
                />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Site web</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Avenue, numéro, quartier, commune, ville..."
              />
            </div>

            {/* Tax ID + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tax_id">N° Impôt / RCCM</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="NIF ou RCCM"
                />
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select
                  value={formData.currency}
                  onValueChange={val => setFormData({ ...formData, currency: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bank info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Banque</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="Ex: Rawbank, TMB..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank_account">N° Compte</Label>
                <Input
                  id="bank_account"
                  value={formData.bank_account}
                  onChange={e => setFormData({ ...formData, bank_account: e.target.value })}
                  placeholder="Numéro de compte"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedSupplier ? "Enregistrer" : "Créer le fournisseur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le fournisseur</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le fournisseur &quot;{selectedSupplier?.name}&quot; ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
