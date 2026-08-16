"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import { ArrowLeft, Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  createProduct,
  checkProductDuplicate,
  uploadProductImage,
  CreateProductData,
  DuplicateCheckResult,
} from "@/actions/products.actions";
import {
  createCategorySearchHandler,
  createBrandSearchHandler,
} from "@/lib/select-search-handlers";
import {
  SellingSetupFields,
  validateSellingSetup,
} from "@/components/products/selling-setup-fields";
import { ProductImageField } from "@/components/products/product-image-field";
import { useCurrency } from "@/components/providers/currency-provider";

/**
 * Création d'un produit.
 *
 * Formulaire volontairement court, sur une seule page : le marchand saisit ce
 * qui est indispensable pour vendre, rien de plus. Les réglages secondaires
 * (description, photo, poids, dimensions, produit vedette…) se complètent
 * depuis la fiche du produit une fois celui-ci créé.
 */
export default function NewProductPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currency: defaultCurrency } = useCurrency();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // La photo part dans un second appel, en multipart : on la garde à part du
  // reste du formulaire, qui voyage en JSON.
  const [image, setImage] = useState<File | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<
    DuplicateCheckResult["duplicates"]
  >({ sku: null, barcode: null });

  const [formData, setFormData] = useState<CreateProductData>({
    name: "",
    sku: "",
    barcode: "",
    category: null,
    brand: null,
    selling_mode: "retail_only",
    unit: null,
    packaging_unit: null,
    units_per_package: null,
    allow_auto_unpacking: true,
    cost_price: 0,
    package_cost_price: null,
    selling_price: 0,
    wholesale_price: null,
    is_taxable: true,
    tax_rate: 0,
    track_inventory: true,
    allow_negative_stock: false,
    has_expiry_date: false,
    min_stock_level: 0,
    reorder_point: 5,
    reorder_quantity: 10,
    // Un produit qu'on vient de créer est destiné à être vendu ; le mettre en
    // avant est une décision qui se prend plus tard, depuis sa fiche.
    is_active: true,
    is_featured: false,
  });

  useEffect(() => {
    const loadOrganization = async () => {
      if (!session?.accessToken) return;
      const result = await getUserOrganizations(session.accessToken);
      if (result.success && result.data && result.data.length > 0) {
        setOrganization(result.data[0]);
      }
    };
    loadOrganization();
  }, [session?.accessToken]);

  const generateSKU = () => {
    if (!formData.name) return;
    const sku =
      formData.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) +
      "-" +
      Date.now().toString().slice(-4);
    setFormData((prev) => ({ ...prev, sku }));
  };

  // Alerte de doublon sur le SKU ou le code-barres, en cours de frappe.
  useEffect(() => {
    const checkDuplicates = async () => {
      if (!session?.accessToken || !organization?.id) return;
      if (!formData.sku && !formData.barcode) {
        setDuplicateWarning({ sku: null, barcode: null });
        return;
      }
      const result = await checkProductDuplicate(
        session.accessToken,
        organization.id,
        formData.sku || undefined,
        formData.barcode || undefined
      );
      if (result.success && result.data) {
        setDuplicateWarning(result.data.duplicates);
      }
    };

    const timer = setTimeout(checkDuplicates, 500);
    return () => clearTimeout(timer);
  }, [formData.sku, formData.barcode, session, organization]);

  const handleChange = (field: keyof CreateProductData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Le nom est requis";
    if (!formData.sku.trim()) newErrors.sku = "Le code SKU est requis";
    if ((formData.cost_price ?? 0) < 0) {
      newErrors.cost_price = "Le prix d'achat ne peut pas être négatif";
    }
    Object.assign(newErrors, validateSellingSetup(formData));

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !session?.accessToken || !organization?.id) return;

    setIsLoading(true);

    const isPackaged = formData.selling_mode !== "retail_only";
    const payload: CreateProductData = {
      ...formData,
      barcode: formData.barcode?.trim() || undefined,
      category: formData.category || null,
      brand: formData.brand || null,
      unit: formData.unit || null,
      // Le conditionnement n'accompagne que les produits qui en ont un.
      packaging_unit: isPackaged ? formData.packaging_unit || null : null,
      units_per_package: isPackaged ? formData.units_per_package || null : null,
      wholesale_price: isPackaged ? formData.wholesale_price || null : null,
      package_cost_price: isPackaged ? formData.package_cost_price || null : null,
    };

    const result = await createProduct(session.accessToken, organization.id, payload);

    if (result.success && result.data) {
      // La photo suit la création. Si son envoi échoue, le produit existe bien :
      // on ne bloque pas le marchand, il pourra la reprendre depuis la fiche.
      if (image) {
        const upload = await uploadProductImage(
          session.accessToken,
          organization.id,
          result.data.id,
          image
        );
        if (!upload.success) {
          toast.warning("Produit créé, mais la photo n'a pas pu être enregistrée", {
            description: "Vous pouvez l'ajouter depuis la fiche du produit.",
          });
        }
      }
      router.push(`/dashboard/products/${result.data.id}`);
    } else {
      if (result.errors) {
        const apiErrors: Record<string, string> = {};
        Object.entries(result.errors).forEach(([key, value]) => {
          apiErrors[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(apiErrors);
      } else {
        setErrors({ general: result.message || "Une erreur est survenue" });
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-2">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau produit</h1>
          <p className="text-sm text-gray-500">
            Renseignez l&apos;essentiel - vous pourrez compléter la fiche ensuite.
          </p>
        </div>
      </div>

      {errors.general && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Photo : elle aide surtout le caissier à retrouver le produit
                d'un coup d'oeil au point de vente. */}
            <ProductImageField
              onChange={setImage}
              error={errors.image}
            />

            <div className="space-y-2">
              <Label htmlFor="name">Nom du produit *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Eau 50cl"
                className={errors.name ? "border-red-500" : ""}
                autoFocus
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">Code SKU *</Label>
                <div className="flex gap-2">
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleChange("sku", e.target.value)}
                    placeholder="EAU-50"
                    className={errors.sku ? "border-red-500" : ""}
                  />
                  <Button type="button" variant="outline" onClick={generateSKU}>
                    Auto
                  </Button>
                </div>
                {errors.sku && <p className="text-sm text-red-500">{errors.sku}</p>}
                {duplicateWarning.sku && (
                  <p className="text-sm text-amber-600">
                    Déjà utilisé par « {duplicateWarning.sku.name} »
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Code-barres</Label>
                <Input
                  id="barcode"
                  value={formData.barcode || ""}
                  onChange={(e) => handleChange("barcode", e.target.value)}
                  placeholder="Optionnel"
                />
                {duplicateWarning.barcode && (
                  <p className="text-sm text-amber-600">
                    Déjà utilisé par « {duplicateWarning.barcode.name} »
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <SearchableSelectAsyncWithEmpty
                  value={formData.category}
                  onValueChange={(value) => handleChange("category", value)}
                  onSearch={
                    session?.accessToken && organization?.id
                      ? createCategorySearchHandler(session.accessToken, organization.id)
                      : async () => []
                  }
                  emptyLabel="Aucune catégorie"
                  placeholder="Sélectionner une catégorie"
                  disabled={!session?.accessToken || !organization?.id}
                />
              </div>

              <div className="space-y-2">
                <Label>Marque</Label>
                <SearchableSelectAsyncWithEmpty
                  value={formData.brand}
                  onValueChange={(value) => handleChange("brand", value)}
                  onSearch={
                    session?.accessToken && organization?.id
                      ? createBrandSearchHandler(session.accessToken, organization.id)
                      : async () => []
                  }
                  emptyLabel="Aucune marque"
                  placeholder="Sélectionner une marque"
                  disabled={!session?.accessToken || !organization?.id}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        {session?.accessToken && organization?.id && (
          <SellingSetupFields
            values={formData}
            onChange={(field, value) =>
              handleChange(field as keyof CreateProductData, value)
            }
            errors={errors}
            accessToken={session.accessToken}
            organizationId={organization.id}
            currencySymbol={defaultCurrency.symbol}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Taxe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <Label htmlFor="is_taxable">Produit taxable</Label>
                <p className="text-sm text-gray-500">Appliquer la TVA à la vente</p>
              </div>
              <Switch
                id="is_taxable"
                checked={formData.is_taxable}
                onCheckedChange={(checked) => handleChange("is_taxable", checked)}
              />
            </div>

            {formData.is_taxable && (
              <div className="max-w-[200px] space-y-2">
                <Label htmlFor="tax_rate">Taux de TVA (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={formData.tax_rate}
                  onChange={(e) =>
                    handleChange("tax_rate", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Suivi du stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div className="pr-4">
                <Label htmlFor="track_inventory">Suivre le stock</Label>
                <p className="text-sm text-gray-500">
                  Décompter les quantités à chaque vente
                </p>
              </div>
              <Switch
                id="track_inventory"
                checked={formData.track_inventory}
                onCheckedChange={(checked) => handleChange("track_inventory", checked)}
              />
            </div>

            {formData.track_inventory && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="min_stock_level">Stock minimum</Label>
                    <Input
                      id="min_stock_level"
                      type="number"
                      min="0"
                      value={formData.min_stock_level}
                      onChange={(e) =>
                        handleChange("min_stock_level", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorder_point">Seuil d&apos;alerte</Label>
                    <Input
                      id="reorder_point"
                      type="number"
                      min="0"
                      value={formData.reorder_point}
                      onChange={(e) =>
                        handleChange("reorder_point", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorder_quantity">Quantité à commander</Label>
                    <Input
                      id="reorder_quantity"
                      type="number"
                      min="0"
                      value={formData.reorder_quantity}
                      onChange={(e) =>
                        handleChange("reorder_quantity", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <div className="pr-4">
                    <Label htmlFor="has_expiry_date">Produit périssable</Label>
                    <p className="text-sm text-gray-500">
                      Suivre les dates de péremption par lot
                    </p>
                  </div>
                  <Switch
                    id="has_expiry_date"
                    checked={formData.has_expiry_date}
                    onCheckedChange={(checked) =>
                      handleChange("has_expiry_date", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <div className="pr-4">
                    <Label htmlFor="allow_negative_stock">Autoriser le stock négatif</Label>
                    <p className="text-sm text-gray-500">
                      Vendre même sans stock enregistré
                    </p>
                  </div>
                  <Switch
                    id="allow_negative_stock"
                    checked={formData.allow_negative_stock}
                    onCheckedChange={(checked) =>
                      handleChange("allow_negative_stock", checked)
                    }
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="sticky -bottom-4 sm:-bottom-7 flex justify-end gap-3 bg-transparent py-4 backdrop-blur-sm">
          <Link href="/dashboard/products">
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Créer le produit
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
