"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice, formatDateTime } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getSupplier,
  deleteSupplier,
  Supplier,
} from "@/actions/contacts.actions";

export default function SupplierDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const result = await getSupplier(session.accessToken, org.id, supplierId);
          if (result.success && result.data) {
            setSupplier(result.data);
          } else {
            toast.error("Fournisseur non trouvé");
            router.push("/dashboard/contacts/suppliers");
          }
        }
      } catch (error) {
        toast.error("Erreur lors du chargement");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session, supplierId]);

  const handleDelete = async () => {
    if (!session?.accessToken || !organization || !supplier) return;

    setIsDeleting(true);
    try {
      const result = await deleteSupplier(session.accessToken, organization.id, supplier.id);
      if (result.success) {
        toast.success("Fournisseur supprimé avec succès");
        router.push("/dashboard/contacts/suppliers");
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <Truck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Fournisseur non trouvé</h3>
        <Link href="/dashboard/contacts/suppliers">
          <Button variant="outline">Retour aux fournisseurs</Button>
        </Link>
      </div>
    );
  }

  const balance = parseFloat(supplier.current_balance);
  const totalPurchases = parseFloat(supplier.total_purchases || "0");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/contacts/suppliers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-purple-100">
              <Truck className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
                <Badge variant={supplier.is_active ? "default" : "secondary"}
                  className={supplier.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                  {supplier.is_active ? "Actif" : "Inactif"}
                </Badge>
                <Badge variant="secondary" className="text-xs">{supplier.currency}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <span>{supplier.code}</span>
                {supplier.contact_person && (
                  <>
                    <span>·</span>
                    <span>{supplier.contact_person}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Wallet className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Solde</p>
                <p className={`text-lg font-bold ${balance > 0 ? "text-orange-600" : "text-green-600"}`}>
                  {formatPrice(balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShoppingBag className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total achats</p>
                <p className="text-lg font-bold">{formatPrice(totalPurchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Produits</p>
                <p className="text-lg font-bold">{supplier.products?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations de contact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {supplier.contact_person && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Contact principal</p>
                      <p className="font-medium">{supplier.contact_person}</p>
                    </div>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Téléphone</p>
                      <p className="font-medium">{supplier.phone}</p>
                    </div>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{supplier.email}</p>
                    </div>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Globe className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Site web</p>
                      <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline">{supplier.website}</a>
                    </div>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Adresse</p>
                      <p className="font-medium">{supplier.address}</p>
                    </div>
                  </div>
                )}
                {supplier.tax_id && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">N° Impôt / RCCM</p>
                      <p className="font-medium">{supplier.tax_id}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Info */}
              {(supplier.bank_name || supplier.bank_account) && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Informations bancaires</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {supplier.bank_name && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Banque</p>
                        <p className="font-semibold">{supplier.bank_name}</p>
                      </div>
                    )}
                    {supplier.bank_account && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">N° Compte</p>
                        <p className="font-semibold">{supplier.bank_account}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t text-xs text-gray-400 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Créé le {formatDateTime(supplier.created_at)}
                </span>
                {supplier.created_by_name && (
                  <span>par {supplier.created_by_name}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Products + Recent Orders */}
        <div className="space-y-6">
          {/* Products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-500" />
                Produits fournis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!supplier.products || supplier.products.length === 0 ? (
                <div className="text-center py-6">
                  <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucun produit</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supplier.products.slice(0, 5).map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{product.product_name}</p>
                        <p className="text-xs text-gray-500">{product.product_sku}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-semibold">{formatPrice(product.unit_price)}</p>
                        {product.is_preferred && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            Préféré
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-green-500" />
                Dernières commandes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!supplier.recent_orders || supplier.recent_orders.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingBag className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucune commande</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supplier.recent_orders.map(order => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{order.reference}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(order.date)}</p>
                      </div>
                      <span className="font-semibold text-sm text-green-600">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le fournisseur</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le fournisseur &quot;{supplier.name}&quot; ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
