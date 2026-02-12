"use client";

import { useState, useEffect } from "react";
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
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Building2,
  User,
  Filter,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  Customer,
  CreateCustomerData,
} from "@/actions/contacts.actions";

export default function CustomersPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateCustomerData>({
    name: "",
    customer_type: "individual",
    company_name: "",
    email: "",
    phone: "",
    address: "",
    tax_id: "",
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const result = await getCustomers(session.accessToken, org.id);
          if (result.success && result.data) {
            setCustomers(result.data);
          }
        }
      } catch (error) {
        toast.error("Erreur lors du chargement des clients");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const resetForm = () => {
    setFormData({
      name: "",
      customer_type: "individual",
      company_name: "",
      email: "",
      phone: "",
      address: "",
      tax_id: "",
      is_active: true,
    });
    setFormErrors({});
  };

  const openCreateDialog = () => {
    setSelectedCustomer(null);
    resetForm();
    setShowCreateDialog(true);
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      customer_type: customer.customer_type,
      company_name: customer.company_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      tax_id: customer.tax_id || "",
      credit_limit: parseFloat(customer.credit_limit) || undefined,
      is_active: customer.is_active,
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
      if (selectedCustomer) {
        const result = await updateCustomer(
          session.accessToken,
          organization.id,
          selectedCustomer.id,
          formData
        );
        if (result.success && result.data) {
          toast.success("Client mis à jour avec succès");
          setCustomers(prev =>
            prev.map(c => (c.id === selectedCustomer.id ? { ...c, ...result.data! } : c))
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
        const result = await createCustomer(session.accessToken, organization.id, formData);
        if (result.success && result.data) {
          toast.success("Client créé avec succès");
          setCustomers(prev => [result.data!, ...prev]);
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
    if (!session?.accessToken || !organization || !selectedCustomer) return;

    setIsSubmitting(true);
    try {
      const result = await deleteCustomer(
        session.accessToken,
        organization.id,
        selectedCustomer.id
      );
      if (result.success) {
        toast.success("Client supprimé avec succès");
        setCustomers(prev => prev.filter(c => c.id !== selectedCustomer.id));
        setShowDeleteDialog(false);
        setSelectedCustomer(null);
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === "all" || c.customer_type === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && c.is_active) ||
      (statusFilter === "inactive" && !c.is_active) ||
      (statusFilter === "with_balance" && parseFloat(c.current_balance) > 0);
    return matchesSearch && matchesType && matchesStatus;
  });

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
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-500 mt-1">
              {customers.length} client{customers.length > 1 ? "s" : ""} enregistré{customers.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
          <UserPlus className="h-4 w-4 mr-2" />
          Nouveau client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom, code, téléphone, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <User className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="individual">Particuliers</SelectItem>
            <SelectItem value="business">Entreprises</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="inactive">Inactifs</SelectItem>
            <SelectItem value="with_balance">Avec dette</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <Card className="p-0">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun client trouvé</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                ? "Essayez de modifier vos filtres"
                : "Créez votre premier client pour commencer"}
            </p>
            {!searchQuery && typeFilter === "all" && statusFilter === "all" && (
              <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
                <UserPlus className="h-4 w-4 mr-2" />
                Créer un client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCustomers.map(customer => (
            <Card key={customer.id} className="p-0 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={`p-3 rounded-lg flex-shrink-0 ${customer.customer_type === "business" ? "bg-purple-100" : "bg-blue-100"}`}>
                    {customer.customer_type === "business" ? (
                      <Building2 className="h-5 w-5 text-purple-600" />
                    ) : (
                      <User className="h-5 w-5 text-blue-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{customer.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {customer.code}
                      </Badge>
                      {!customer.is_active && (
                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                          Inactif
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      {customer.customer_type === "business" && customer.company_name && (
                        <span className="text-gray-600 font-medium">{customer.company_name}</span>
                      )}
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {customer.email}
                        </span>
                      )}
                      {customer.customer_type === "business" && customer.tax_id && (
                        <span className="text-xs text-gray-400">NIF: {customer.tax_id}</span>
                      )}
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right hidden sm:block">
                    {parseFloat(customer.current_balance) > 0 ? (
                      <div>
                        <p className="text-sm font-semibold text-red-600">
                          {formatPrice(customer.current_balance)}
                        </p>
                        <p className="text-xs text-gray-500">Doit</p>
                      </div>
                    ) : parseFloat(customer.current_balance) < 0 ? (
                      <div>
                        <p className="text-sm font-semibold text-blue-600">
                          {formatPrice(Math.abs(parseFloat(customer.current_balance)))}
                        </p>
                        <p className="text-xs text-gray-500">Avance</p>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                        OK
                      </Badge>
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
                        onClick={() => router.push(`/dashboard/contacts/customers/${customer.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Voir détails
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedCustomer(customer);
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
        </div>
      )}

      {/* Create/Edit Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? "Modifier le client" : "Nouveau client"}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer
                ? "Modifiez les informations du client"
                : "Enregistrez un nouveau client"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div className="space-y-2">
              <Label>Type de client *</Label>
              <Select
                value={formData.customer_type}
                onValueChange={(val: "individual" | "business") =>
                  setFormData({ ...formData, customer_type: val })
                }
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Particulier</SelectItem>
                  <SelectItem value="business">Entreprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {formData.customer_type === "business" ? "Nom de l'entreprise" : "Nom complet"} *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.customer_type === "business" ? "Ex: Congo Tech SARL" : "Ex: Jean Mukendi"}
              />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>

            {/* Company name (business only) */}
            {formData.customer_type === "business" && (
              <div className="space-y-2">
                <Label htmlFor="company_name">Raison sociale</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Raison sociale complète"
                />
              </div>
            )}

            {/* Téléphone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                required
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+243 XXX XXX XXX"
              />
              {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="client@exemple.com"
              />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>

            {/* Adresse */}
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Avenue, numéro, quartier, commune..."
              />
            </div>

            {/* NIF/RCCM (business only) */}
            {formData.customer_type === "business" && (
              <div className="space-y-2">
                <Label htmlFor="tax_id">N° Impôt / RCCM</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="NIF ou RCCM"
                />
              </div>
            )}

            {/* Limite de crédit */}
            <div className="space-y-2">
              <Label htmlFor="credit_limit">Limite de crédit autorisée</Label>
              <Input
                id="credit_limit"
                type="number"
                step="0.01"
                min="0"
                value={formData.credit_limit || ""}
                onChange={e => setFormData({ ...formData, credit_limit: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0 = pas de limite"
              />
              <p className="text-xs text-gray-400">
                Montant maximum que ce client peut prendre à crédit. Laissez vide ou 0 pour ne pas limiter.
              </p>
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
                {selectedCustomer ? "Enregistrer" : "Créer le client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le client</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le client &quot;{selectedCustomer?.name}&quot; ?
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
