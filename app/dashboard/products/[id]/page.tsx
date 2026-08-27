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
import { ProductThumb } from "@/components/products/product-thumb";
import { formatUnitQuantity, pluralizeUnit } from "@/lib/units";

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
  /** Vrai seulement si le serveur a répondu que le produit n'existe pas. */
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  // Fetch product
  useEffect(() => {
    async function fetchProduct() {
      if (!productId) {
        setError("Aucun produit demandé.");
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      // Tant que la session ou l'organisation ne sont pas prêtes, on reste en
      // chargement : conclure « introuvable » à ce stade serait faux.
      if (!session?.accessToken || !organization?.id) return;

      setIsLoading(true);
      setError(null);
      setNotFound(false);

      const result = await getProduct(session.accessToken, organization.id, productId);

      if (result.success && result.data) {
        setProduct(result.data);
      } else {
        const message = result.message || "La fiche n'a pas pu être chargée.";
        setError(message);
        setNotFound(/non trouv|introuvable|not found/i.test(message));
      }
      setIsLoading(false);
    }
    fetchProduct();
  }, [session?.accessToken, organization?.id, productId, reloadKey]);

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
    // Le produit peut être réellement absent, mais l'écran s'affichait aussi
    // quand l'organisation n'avait pas pu être chargée ou que l'appel avait
    // échoué : le message accusait alors le produit à tort. On distingue les
    // deux, et on propose de réessayer quand la cause est passagère.
    const introuvable = notFound;
    return (
      <div className="p-4 lg:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            {introuvable ? "Produit introuvable" : "Chargement impossible"}
          </h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle
              className={cn(
                "h-12 w-12 mb-4",
                introuvable ? "text-red-500" : "text-amber-500"
              )}
            />
            <p className="text-gray-600">
              {introuvable
                ? "Ce produit n'existe pas ou a été supprimé."
                : error || "La fiche n'a pas pu être chargée."}
            </p>
            <div className="mt-4 flex gap-3">
              {!introuvable && (
                <Button onClick={() => setReloadKey((k) => k + 1)}>
                  Réessayer
                </Button>
              )}
              <Link href="/dashboard/products">
                <Button variant="outline">Retour aux produits</Button>
              </Link>
            </div>
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

  // Conditionnement : les libellés viennent du produit, jamais d'un mot figé,
  // pour que la fiche parle la langue du marchand (paquet, carton, casier…).
  const isPackaged =
    !!product.selling_mode && product.selling_mode !== "retail_only";
  const retailWord = product.unit_name || "unité";
  const packageWord = product.packaging_unit_name || "contenant";
  const retailPlural = pluralizeUnit(retailWord, 2);
  const sellingModeLabel =
    product.selling_mode === "wholesale_only"
      ? "Vente en gros"
      : product.selling_mode === "wholesale_and_retail"
        ? "Vente en gros et au détail"
        : "Vente au détail";
  const packageCostPrice = product.package_cost_price
    ? parseFloat(product.package_cost_price)
    : null;

  return (
    <div className="mx-auto">
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
            <div className="flex flex-col gap-5 p-5 sm:flex-row">
              {/* Vignette de taille fixe : un carré d'un tiers de largeur
                  laissait un grand vide pour les produits sans photo, qui sont
                  la majorité. */}
              <ProductThumb
                src={product.image}
                alt={product.name}
                className="h-40 w-40 shrink-0 self-center rounded-xl sm:self-start"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {/* Catégorie, marque et code-barres sur une seule ligne */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
                  {product.category_name && (
                    <span className="flex items-center gap-1.5">
                      <Tag className="h-4 w-4 text-gray-400" />
                      {product.category_name}
                    </span>
                  )}
                  {product.brand_name && (
                    <span className="font-medium text-gray-700">
                      {product.brand_name}
                    </span>
                  )}
                  {product.barcode && (
                    <span className="flex items-center gap-1.5">
                      <Barcode className="h-4 w-4 text-gray-400" />
                      {product.barcode}
                    </span>
                  )}
                </div>

                {product.short_description && (
                  <p className="text-sm text-gray-600">{product.short_description}</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{sellingModeLabel}</Badge>
                  {isPackaged && product.units_per_package && (
                    <Badge variant="outline" className="font-normal">
                      1 {packageWord} = {formatUnitQuantity(product.units_per_package, retailWord)}
                    </Badge>
                  )}
                </div>

                {/* Prix côte à côte : les deux tarifs se comparent d'un coup
                    d'oeil, au lieu d'être empilés à des tailles différentes. */}
                <div className="mt-auto flex flex-wrap gap-x-10 gap-y-3 border-t pt-4">
                  {product.selling_mode !== "wholesale_only" && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {isPackaged ? `Prix / ${retailWord}` : "Prix de vente"}
                      </p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatPrice(product.selling_price)}
                      </p>
                    </div>
                  )}
                  {isPackaged && product.wholesale_price && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Prix / {packageWord}
                      </p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatPrice(product.wholesale_price)}
                      </p>
                    </div>
                  )}
                  {!isPackaged && product.wholesale_price && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Prix de gros
                      </p>
                      <p className="text-2xl font-bold text-gray-700">
                        {formatPrice(product.wholesale_price)}
                      </p>
                    </div>
                  )}
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
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Stock</p>
                  <p className={cn("font-semibold", isLowStock && "text-red-600")}>
                    {!product.track_inventory
                      ? "Non suivi"
                      : product.stock_display ||
                        `${stockQuantity} ${product.unit_symbol || ""}`}
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
              <DetailItem label="Type de vente" value={sellingModeLabel} />
              <DetailItem
                label={isPackaged ? "Unité (détail)" : "Unité"}
                value={product.unit_name || "-"}
              />
              {isPackaged && (
                <>
                  <DetailItem label="Contenant" value={product.packaging_unit_name || "-"} />
                  <DetailItem
                    label={`Nombre de ${retailPlural} par ${packageWord}`}
                    value={String(product.units_per_package ?? "-")}
                  />
                  <DetailItem
                    label={`Prix d'achat (${packageWord})`}
                    value={packageCostPrice ? formatPrice(packageCostPrice) : "-"}
                  />
                  <DetailItem
                    label={`Prix de vente (${packageWord})`}
                    value={product.wholesale_price ? formatPrice(product.wholesale_price) : "-"}
                  />
                </>
              )}
              {product.selling_mode === "wholesale_and_retail" && (
                <DetailItem
                  label={`Ouverture automatique d'un ${packageWord}`}
                  value={product.allow_auto_unpacking ? "Activée" : "Désactivée"}
                />
              )}
              <DetailItem label="Taxable" value={product.is_taxable ? "Oui" : "Non"} />
              {product.is_taxable && (
                <DetailItem label="Taux TVA" value={`${product.tax_rate}%`} />
              )}
              {product.track_inventory && (
                <>
                  <DetailItem label="Stock minimum" value={String(product.min_stock_level)} />
                  <DetailItem label="Seuil réappro." value={String(product.reorder_point)} />
                  <DetailItem label="Qté réappro." value={String(product.reorder_quantity)} />
                  <DetailItem label="Produit périssable" value={product.has_expiry_date ? "Oui" : "Non"} />
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
                      <p className="font-semibold">
                        {stock.display || `${stock.available} disponible`}
                      </p>
                      {isPackaged && stock.packages !== undefined && (
                        <p className="text-xs text-gray-500">
                          {formatUnitQuantity(stock.packages, packageWord)}{" "}
                          {stock.packages > 1 ? "scellés" : "scellé"}
                          {parseFloat(stock.loose || "0") > 0 &&
                            ` · ${formatUnitQuantity(
                              parseFloat(stock.loose || "0"),
                              retailWord
                            )} à l'unité`}
                        </p>
                      )}
                      {/* `display` porte le DISPONIBLE : dès qu'une réservation
                          l'écarte du rayon, on montre les deux, sinon le
                          gérant croit avoir perdu du stock. */}
                      {parseFloat(stock.reserved) > 0 && (
                        <>
                          {stock.quantity_display?.trim() && (
                            <p className="text-xs text-gray-500">
                              {stock.quantity_display} en rayon
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {stock.reserved_display?.trim() || stock.reserved} réservé
                          </p>
                        </>
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
