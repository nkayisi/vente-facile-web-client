"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  Package,
  Barcode,
  Tag,
  DollarSign,
  Boxes,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import { getProduct, deleteProduct, Product } from "@/actions/products.actions";
import { cn } from "@/lib/utils";

export default function ProductDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  // Fetch product
  useEffect(() => {
    async function fetchProduct() {
      if (!session?.accessToken || !organization?.id || !productId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const result = await getProduct(session.accessToken, organization.id, productId);

      if (result.success && result.data) {
        setProduct(result.data);
      } else {
        setError(result.message || "Produit non trouvé");
      }
      setIsLoading(false);
    }
    fetchProduct();
  }, [session, organization, productId]);

  // Handle delete
  const handleDelete = async () => {
    if (!product || !session?.accessToken || !organization?.id) return;

    setIsDeleting(true);
    const result = await deleteProduct(session.accessToken, organization.id, product.id);

    if (result.success) {
      router.push("/dashboard/products");
    } else {
      setError(result.message || "Erreur lors de la suppression");
      setDeleteDialogOpen(false);
    }
    setIsDeleting(false);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Produit non trouvé</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-gray-600">{error || "Ce produit n'existe pas ou a été supprimé."}</p>
            <Link href="/dashboard/products" className="mt-4">
              <Button variant="outline">Retour aux produits</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stockQuantity = product.stock_quantity ?? 0;
  const isLowStock = product.track_inventory && stockQuantity <= product.reorder_point;
  const costPrice = parseFloat(product.cost_price);
  const sellingPrice = parseFloat(product.selling_price);
  const profitMargin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {product.sku}
              </Badge>
              {!product.is_active && (
                <Badge variant="secondary">Inactif</Badge>
              )}
              {product.is_featured && (
                <Badge className="bg-orange-500">Vedette</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/products/${product.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </Link>
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Main Info Card */}
        <Card className="p-0">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              {/* Product Image */}
              <div className="w-full md:w-1/3 aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-16 w-16 text-gray-300" />
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 p-6">
                <div className="space-y-4">
                  {/* Category & Brand */}
                  <div className="flex flex-wrap gap-2">
                    {product.category_name && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Tag className="h-4 w-4" />
                        {product.category_name}
                      </div>
                    )}
                    {product.brand_name && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <span className="font-medium">{product.brand_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Barcode */}
                  {product.barcode && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Barcode className="h-4 w-4" />
                      <span>{product.barcode}</span>
                    </div>
                  )}

                  {/* Description */}
                  {product.short_description && (
                    <p className="text-gray-600">{product.short_description}</p>
                  )}

                  {/* Price */}
                  <div className="pt-4 border-t">
                    <p className="text-3xl font-bold text-orange-600">
                      {formatPrice(product.selling_price)}
                    </p>
                    {product.wholesale_price && (
                      <p className="text-sm text-gray-500 mt-1">
                        Prix de gros: {formatPrice(product.wholesale_price)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cost Price */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Prix d'achat</p>
                  <p className="font-semibold">{formatPrice(product.cost_price)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profit Margin */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Marge</p>
                  <p className="font-semibold text-green-600">{profitMargin.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stock */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isLowStock ? "bg-red-100" : "bg-orange-100"
                )}>
                  <Boxes className={cn("h-5 w-5", isLowStock ? "text-red-600" : "text-orange-600")} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Stock</p>
                  <p className={cn("font-semibold", isLowStock && "text-red-600")}>
                    {product.track_inventory ? `${stockQuantity} ${product.unit_symbol || ""}` : "Non suivi"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  product.is_active ? "bg-green-100" : "bg-gray-100"
                )}>
                  {product.is_active ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Statut</p>
                  <p className="font-semibold">{product.is_active ? "Actif" : "Inactif"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Détails du produit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem label="Unité" value={product.unit_name || "-"} />
              <DetailItem label="Taxable" value={product.is_taxable ? "Oui" : "Non"} />
              {product.is_taxable && (
                <DetailItem label="Taux TVA" value={`${product.tax_rate}%`} />
              )}
              {product.track_inventory && (
                <>
                  <DetailItem label="Stock minimum" value={String(product.min_stock_level)} />
                  <DetailItem label="Seuil réappro." value={String(product.reorder_point)} />
                  <DetailItem label="Qté réappro." value={String(product.reorder_quantity)} />
                  <DetailItem label="Stock négatif" value={product.allow_negative_stock ? "Autorisé" : "Non autorisé"} />
                </>
              )}
            </div>

            {product.short_description && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-gray-600 whitespace-pre-wrap">{product.short_description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by Warehouse */}
        {product.track_inventory && product.stock_by_warehouse && product.stock_by_warehouse.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock par entrepôt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {product.stock_by_warehouse.map((stock) => (
                  <div
                    key={stock.warehouse_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium">{stock.warehouse_name}</span>
                    <div className="text-right">
                      <p className="font-semibold">{stock.available} disponible</p>
                      {parseFloat(stock.reserved) > 0 && (
                        <p className="text-xs text-gray-500">{stock.reserved} réservé</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{product.name}</strong> ?
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
