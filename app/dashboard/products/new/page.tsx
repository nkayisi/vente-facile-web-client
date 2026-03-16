"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  ArrowLeft,
  Loader2,
  Package,
  DollarSign,
  Boxes,
  Settings,
  Save,
  Check,
} from "lucide-react";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  createProduct,
  getCategories,
  getBrands,
  getUnits,
  Category,
  Brand,
  Unit,
  CreateProductData,
} from "@/actions/products.actions";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { useCurrency } from "@/components/providers/currency-provider";

export default function NewProductPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { currency: defaultCurrency } = useCurrency();

  // Organization
  const [organization, setOrganization] = useState<Organization | null>(null);

  // Form data
  const [formData, setFormData] = useState<CreateProductData>({
    name: "",
    sku: "",
    barcode: "",
    short_description: "",
    category: null,
    brand: null,
    unit: null,
    cost_price: 0,
    selling_price: 0,
    wholesale_price: null,
    tax_rate: 0,
    is_taxable: true,
    track_inventory: true,
    allow_negative_stock: false,
    min_stock_level: 0,
    reorder_point: 5,
    reorder_quantity: 10,
    is_active: true,
    is_featured: false,
  });

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"general" | "pricing" | "stock" | "settings">("general");
  const [completedTabs, setCompletedTabs] = useState<Set<string>>(new Set());

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

  // Fetch reference data
  useEffect(() => {
    async function fetchReferenceData() {
      if (!session?.accessToken || !organization?.id) {
        setIsFetchingData(false);
        return;
      }

      setIsFetchingData(true);

      const [categoriesResult, brandsResult, unitsResult] = await Promise.all([
        getCategories(session.accessToken, organization.id),
        getBrands(session.accessToken, organization.id),
        getUnits(session.accessToken, organization.id),
      ]);

      if (categoriesResult.success && categoriesResult.data) {
        setCategories(categoriesResult.data.results || []);
      }
      if (brandsResult.success && brandsResult.data) {
        setBrands(brandsResult.data.results || []);
      }
      if (unitsResult.success && unitsResult.data) {
        setUnits(unitsResult.data.results || []);
      }

      setIsFetchingData(false);
    }
    fetchReferenceData();
  }, [session, organization]);

  // Generate SKU from name
  const generateSKU = () => {
    if (formData.name) {
      const sku = formData.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) + "-" + Date.now().toString().slice(-4);
      setFormData((prev) => ({ ...prev, sku }));
    }
  };

  // Handle input change
  const handleChange = (field: keyof CreateProductData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate current tab
  const validateCurrentTab = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === "general") {
      if (!formData.name.trim()) {
        newErrors.name = "Le nom est requis";
      }
      if (!formData.sku.trim()) {
        newErrors.sku = "Le SKU est requis";
      }
    }

    if (activeTab === "pricing") {
      if (formData.selling_price <= 0) {
        newErrors.selling_price = "Le prix de vente doit être supérieur à 0";
      }
      if (formData.cost_price < 0) {
        newErrors.cost_price = "Le prix d'achat ne peut pas être négatif";
      }
      if (formData.selling_price < formData.cost_price) {
        newErrors.selling_price = "Le prix de vente ne peut pas être inférieur au prix d'achat";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate all form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est requis";
    }
    if (!formData.sku.trim()) {
      newErrors.sku = "Le SKU est requis";
    }
    if (formData.selling_price <= 0) {
      newErrors.selling_price = "Le prix de vente doit être supérieur à 0";
    }
    if (formData.cost_price < 0) {
      newErrors.cost_price = "Le prix d'achat ne peut pas être négatif";
    }
    if (formData.selling_price < formData.cost_price) {
      newErrors.selling_price = "Le prix de vente ne peut pas être inférieur au prix d'achat";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next tab
  const handleNext = () => {
    if (!validateCurrentTab()) return;

    setCompletedTabs(prev => new Set(prev).add(activeTab));

    const tabOrder: ("general" | "pricing" | "stock" | "settings")[] = ["general", "pricing", "stock", "settings"];
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    }
  };

  // Handle previous tab
  const handlePrevious = () => {
    const tabOrder: ("general" | "pricing" | "stock" | "settings")[] = ["general", "pricing", "stock", "settings"];
    const currentIndex = tabOrder.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm() || !session?.accessToken || !organization?.id) {
      console.log("Validation finale échouée");
      return;
    }

    setIsLoading(true);

    // Nettoyer les données : convertir les chaînes vides en null
    const cleanedData = {
      ...formData,
      barcode: formData.barcode?.trim() || undefined,
      short_description: formData.short_description?.trim() || undefined,
      category: formData.category || null,
      brand: formData.brand || null,
      unit: formData.unit || null,
      wholesale_price: formData.wholesale_price || null,
    };

    console.log("Données envoyées au backend:", cleanedData);

    const result = await createProduct(session.accessToken, organization.id, cleanedData);
    console.log("Résultat de la création:", result);

    if (result.success) {
      router.push("/dashboard/products");
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
    }

    setIsLoading(false);
  };

  const tabs = [
    { id: "general", label: "Général", icon: Package },
    { id: "pricing", label: "Prix", icon: DollarSign },
    { id: "stock", label: "Stock", icon: Boxes },
    { id: "settings", label: "Options", icon: Settings },
  ] as const;

  if (isFetchingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Nouveau produit</h1>
          <p className="text-sm text-gray-500">Ajoutez un nouveau produit à votre catalogue</p>
        </div>
      </div>

      {/* Error message */}
      {errors.general && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-700">{errors.general}</p>
        </div>
      )}

      <div>
        {/* Mobile Tabs */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCompleted = completedTabs.has(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors relative",
                  activeTab === tab.id
                    ? "bg-orange-500 text-white"
                    : isCompleted
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {isCompleted && activeTab !== tab.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* General Tab */}
        {activeTab === "general" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nom du produit *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ex: Coca-Cola 33cl"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU (Code article) *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => handleChange("sku", e.target.value.toUpperCase())}
                      placeholder="Ex: COCA-33CL"
                      className={cn("flex-1", errors.sku ? "border-red-500" : "")}
                    />
                    <Button type="button" color="primary" variant="outline" onClick={generateSKU}>
                      Auto
                    </Button>
                  </div>
                  {errors.sku && <p className="text-sm text-red-500">{errors.sku}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Code-barres</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode || ""}
                    onChange={(e) => handleChange("barcode", e.target.value)}
                    placeholder="Ex: 5449000000996"
                  />
                </div>
              </div>

              {/* Category & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <SearchableSelect
                    options={[
                      { value: "none", label: "Aucune catégorie" },
                      ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
                    ]}
                    value={formData.category || "none"}
                    onValueChange={(value) => handleChange("category", value === "none" ? null : value)}
                    placeholder="Sélectionner une catégorie"
                    searchPlaceholder="Rechercher une catégorie..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marque</Label>
                  <SearchableSelect
                    options={[
                      { value: "none", label: "Aucune marque" },
                      ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
                    ]}
                    value={formData.brand || "none"}
                    onValueChange={(value) => handleChange("brand", value === "none" ? null : value)}
                    placeholder="Sélectionner une marque"
                    searchPlaceholder="Rechercher une marque..."
                  />
                </div>
              </div>

              {/* Unit & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unité de mesure</Label>
                  <SearchableSelect
                    options={[
                      { value: "none", label: "Aucune unité" },
                      ...units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` })),
                    ]}
                    value={formData.unit || "none"}
                    onValueChange={(value) => handleChange("unit", value === "none" ? null : value)}
                    placeholder="Sélectionner une unité"
                    searchPlaceholder="Rechercher une unité..."
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="short_description">Description</Label>
                <Textarea
                  id="short_description"
                  value={formData.short_description || ""}
                  onChange={(e) => handleChange("short_description", e.target.value)}
                  placeholder="Description du produit"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500">Maximum 500 caractères</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Tab */}
        {activeTab === "pricing" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prix et taxes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cost & Selling Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Prix d'achat ({defaultCurrency.symbol})</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="any"
                    value={formData.cost_price}
                    onChange={(e) => handleChange("cost_price", parseFloat(e.target.value) || 0)}
                    className={errors.cost_price ? "border-red-500" : ""}
                  />
                  {errors.cost_price && <p className="text-sm text-red-500">{errors.cost_price}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selling_price">Prix de vente ({defaultCurrency.symbol}) *</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    min="0"
                    step="any"
                    value={formData.selling_price}
                    onChange={(e) => handleChange("selling_price", parseFloat(e.target.value) || 0)}
                    className={errors.selling_price ? "border-red-500" : ""}
                  />
                  {errors.selling_price && <p className="text-sm text-red-500">{errors.selling_price}</p>}
                </div>
              </div>

              {/* Wholesale Price */}
              <div className="space-y-2">
                <Label htmlFor="wholesale_price">Prix de gros ({defaultCurrency.symbol})</Label>
                <Input
                  id="wholesale_price"
                  type="number"
                  min="0"
                  step="any"
                  value={formData.wholesale_price || ""}
                  onChange={(e) => handleChange("wholesale_price", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Optionnel"
                />
              </div>

              {/* Profit Margin Preview */}
              {formData.cost_price > 0 && formData.selling_price > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Marge bénéficiaire</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(((formData.selling_price - formData.cost_price) / formData.cost_price) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500">
                    Bénéfice: {formatPrice(formData.selling_price - formData.cost_price)}
                  </p>
                </div>
              )}

              {/* Tax */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="is_taxable">Produit taxable</Label>
                  <p className="text-sm text-gray-500">Appliquer la TVA sur ce produit</p>
                </div>
                <Switch
                  id="is_taxable"
                  checked={formData.is_taxable}
                  onCheckedChange={(checked) => handleChange("is_taxable", checked)}
                />
              </div>

              {formData.is_taxable && (
                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Taux de TVA (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.tax_rate}
                    onChange={(e) => handleChange("tax_rate", parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* stock Tab */}
        {activeTab === "stock" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gestion des stocks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Track stock */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="track_inventory">Suivre le stock</Label>
                  <p className="text-sm text-gray-500">Activer la gestion des stocks pour ce produit</p>
                </div>
                <Switch
                  id="track_inventory"
                  checked={formData.track_inventory}
                  onCheckedChange={(checked) => handleChange("track_inventory", checked)}
                />
              </div>

              {formData.track_inventory && (
                <>
                  {/* Allow Negative Stock */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label htmlFor="allow_negative_stock">Autoriser stock négatif</Label>
                      <p className="text-sm text-gray-500">Permettre les ventes même si le stock est insuffisant</p>
                    </div>
                    <Switch
                      id="allow_negative_stock"
                      checked={formData.allow_negative_stock}
                      onCheckedChange={(checked) => handleChange("allow_negative_stock", checked)}
                    />
                  </div>

                  {/* Stock Levels */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_stock_level">Stock minimum</Label>
                      <Input
                        id="min_stock_level"
                        type="number"
                        min="0"
                        value={formData.min_stock_level}
                        onChange={(e) => handleChange("min_stock_level", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorder_point">Seuil de réapprovisionnement</Label>
                      <Input
                        id="reorder_point"
                        type="number"
                        min="0"
                        value={formData.reorder_point}
                        onChange={(e) => handleChange("reorder_point", parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-gray-500">Alerte quand le stock atteint ce niveau</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reorder_quantity">Quantité de réapprovisionnement</Label>
                    <Input
                      id="reorder_quantity"
                      type="number"
                      min="0"
                      value={formData.reorder_quantity}
                      onChange={(e) => handleChange("reorder_quantity", parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-gray-500">Quantité suggérée lors du réapprovisionnement</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Options avancées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Active */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="is_active">Produit actif</Label>
                  <p className="text-sm text-gray-500">Le produit est visible et peut être vendu</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleChange("is_active", checked)}
                />
              </div>

              {/* Featured */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label htmlFor="is_featured">Produit vedette</Label>
                  <p className="text-sm text-gray-500">Mettre en avant ce produit</p>
                </div>
                <Switch
                  id="is_featured"
                  checked={formData.is_featured}
                  onCheckedChange={(checked) => handleChange("is_featured", checked)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          {activeTab !== "general" && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={isLoading}
            >
              Précédent
            </Button>
          )}

          {activeTab !== "settings" ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isLoading}
              className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600"
            >
              Suivant
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Créer le produit
                </>
              )}
            </Button>
          )}

          <Link href="/dashboard/products">
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Annuler
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
