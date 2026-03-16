"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  Settings,
  Coins,
  Gift,
  Star,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  RefreshCw,
  ArrowRightLeft,
  Crown,
  Loader2,
  Save,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Info,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import {
  Currency,
  OrganizationCurrency,
  LoyaltyProgram,
  OrganizationSettings,
  getCurrencies,
  getOrganizationCurrencies,
  addOrganizationCurrency,
  updateOrganizationCurrency,
  deleteOrganizationCurrency,
  setPrimaryCurrency,
  updateExchangeRate,
  getLoyaltyProgram,
  createLoyaltyProgram,
  updateLoyaltyProgram,
  toggleLoyaltyProgram,
  getOrganizationSettings,
  updateOrganizationSettings,
} from "@/actions/settings.actions";

export default function SettingsPage() {
  const { data: session } = useSession();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [activeTab, setActiveTab] = useState("currencies");
  const [isLoading, setIsLoading] = useState(true);

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

  // Currencies
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [showAddCurrencyDialog, setShowAddCurrencyDialog] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const [rateFromCurrency, setRateFromCurrency] = useState<string>(""); // Devise de référence pour le taux
  const [rateToCurrency, setRateToCurrency] = useState<string>(""); // Devise cible

  // Loyalty Program
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [showLoyaltyDialog, setShowLoyaltyDialog] = useState(false);

  // Loyalty form
  const [loyaltyForm, setLoyaltyForm] = useState({
    name: "Programme de fidélité",
    points_calculation_type: "fixed_per_amount" as "fixed_per_amount" | "percentage",
    points_per_unit: 1,
    amount_per_unit: "1000",
    points_percentage: "1",
    point_value: "1",
    min_points_to_redeem: 100,
    points_expiry_days: 0,
    only_registered_customers: true,
  });


  // Organization Settings
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    receipt_header: "",
    receipt_footer: "",
    show_loyalty_points_on_receipt: true,
    low_stock_threshold: 10,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsLoading(true);
    try {
      const [currenciesRes, orgCurrenciesRes, loyaltyRes, settingsRes] = await Promise.all([
        getCurrencies(session.accessToken),
        getOrganizationCurrencies(session.accessToken, organization.id),
        getLoyaltyProgram(session.accessToken, organization.id),
        getOrganizationSettings(session.accessToken, organization.id),
      ]);

      if (currenciesRes.success && currenciesRes.data) {
        console.log('[Settings] Currencies loaded:', currenciesRes.data);
        setCurrencies(currenciesRes.data);
      }
      if (orgCurrenciesRes.success && orgCurrenciesRes.data) {
        console.log('[Settings] Organization currencies loaded:', orgCurrenciesRes.data);
        setOrgCurrencies(Array.isArray(orgCurrenciesRes.data) ? orgCurrenciesRes.data : []);
      } else {
        console.log('[Settings] Organization currencies failed or empty:', orgCurrenciesRes);
      }
      if (loyaltyRes.success) setLoyaltyProgram(loyaltyRes.data || null);
      if (settingsRes.success && settingsRes.data) {
        setOrgSettings(settingsRes.data);
        setSettingsForm({
          receipt_header: settingsRes.data.receipt_header || "",
          receipt_footer: settingsRes.data.receipt_footer || "",
          show_loyalty_points_on_receipt: settingsRes.data.show_loyalty_points_on_receipt,
          low_stock_threshold: settingsRes.data.low_stock_threshold,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Currency handlers
  const handleAddCurrency = async () => {
    if (!session?.accessToken || !organization?.id || !selectedCurrency) return;

    setIsSaving(true);
    try {
      const result = await addOrganizationCurrency(session.accessToken, organization.id, {
        currency: selectedCurrency,
        exchange_rate: exchangeRate,
        is_primary: orgCurrencies.length === 0,
      });

      if (result.success) {
        toast.success("Devise ajoutée avec succès");
        setShowAddCurrencyDialog(false);
        setSelectedCurrency("");
        setExchangeRate("1");
        loadData();
      } else {
        toast.error(result.message || "Erreur lors de l'ajout");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async (currencyId: string) => {
    if (!session?.accessToken || !organization?.id) return;

    const result = await setPrimaryCurrency(session.accessToken, organization.id, currencyId);
    if (result.success) {
      toast.success("Devise principale mise à jour");
      loadData();
    } else {
      toast.error(result.message || "Erreur");
    }
  };

  const handleUpdateRate = async (currencyId: string) => {
    if (!session?.accessToken || !organization?.id || !newRate) return;

    // Convention backend: exchange_rate = combien d'unités de devise_principale pour 1 unité de cette devise
    // Exemple: USD avec exchange_rate=2800 signifie 1 USD = 2800 CDF (si CDF est principale)
    // L'UI affiche aussi: 1 USD = 2800 CDF
    // Donc le format est déjà correct !

    let finalRate = newRate;

    if (rateFromCurrency && rateToCurrency) {
      const fromCurr = orgCurrencies.find(c => c.currency_code === rateFromCurrency);
      const toCurr = orgCurrencies.find(c => c.currency_code === rateToCurrency);

      if (fromCurr && toCurr) {
        const rateValue = parseFloat(newRate);

        if (toCurr.is_primary) {
          // L'utilisateur a saisi: 1 fromCurrency = rateValue principale
          // Le backend veut exactement ça: exchange_rate de fromCurrency = rateValue
          finalRate = rateValue.toString();
        } else if (fromCurr.is_primary) {
          // L'utilisateur a saisi: 1 principale = rateValue toCurrency
          // Le backend veut: 1 toCurrency = X principale
          // Donc X = 1 / rateValue
          finalRate = (1 / rateValue).toString();
        } else {
          // Conversion entre deux devises secondaires
          // L'utilisateur a saisi: 1 fromCurrency = rateValue toCurrency
          // fromRate = combien de principale pour 1 fromCurrency
          // On veut: combien de principale pour 1 toCurrency
          const fromRate = parseFloat(fromCurr.exchange_rate);
          const toRate = fromRate / rateValue;
          finalRate = toRate.toString();
        }
      }
    }

    const result = await updateExchangeRate(session.accessToken, organization.id, currencyId, finalRate);
    if (result.success) {
      toast.success("Taux de change mis à jour");
      setEditingRate(null);
      setNewRate("");
      setRateFromCurrency("");
      setRateToCurrency("");
      loadData();
    } else {
      toast.error(result.message || "Erreur");
    }
  };

  const handleDeleteCurrency = async (currencyId: string) => {
    if (!session?.accessToken || !organization?.id) return;

    const result = await deleteOrganizationCurrency(session.accessToken, organization.id, currencyId);
    if (result.success) {
      toast.success("Devise supprimée");
      loadData();
    } else {
      toast.error(result.message || "Erreur");
    }
  };

  // Loyalty handlers
  const handleSaveLoyaltyProgram = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSaving(true);
    try {
      let result;
      if (loyaltyProgram) {
        result = await updateLoyaltyProgram(
          session.accessToken,
          organization.id,
          loyaltyProgram.id,
          loyaltyForm
        );
      } else {
        result = await createLoyaltyProgram(session.accessToken, organization.id, loyaltyForm);
      }

      if (result.success) {
        toast.success("Programme de fidélité enregistré");
        setShowLoyaltyDialog(false);
        loadData();
      } else {
        toast.error(result.message || "Erreur");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLoyalty = async () => {
    if (!session?.accessToken || !organization?.id || !loyaltyProgram) return;

    const result = await toggleLoyaltyProgram(session.accessToken, organization.id, loyaltyProgram.id);
    if (result.success && result.data) {
      toast.success(result.data.message);
      loadData();
    } else {
      toast.error(result.message || "Erreur");
    }
  };


  // Settings handlers
  const handleSaveSettings = async () => {
    if (!session?.accessToken || !organization?.id) return;

    setIsSaving(true);
    try {
      const result = await updateOrganizationSettings(session.accessToken, organization.id, settingsForm);
      if (result.success) {
        toast.success("Paramètres enregistrés");
        loadData();
      } else {
        toast.error(result.message || "Erreur");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openLoyaltyDialog = () => {
    if (loyaltyProgram) {
      setLoyaltyForm({
        name: loyaltyProgram.name,
        points_calculation_type: loyaltyProgram.points_calculation_type,
        points_per_unit: loyaltyProgram.points_per_unit,
        amount_per_unit: loyaltyProgram.amount_per_unit,
        points_percentage: loyaltyProgram.points_percentage,
        point_value: loyaltyProgram.point_value,
        min_points_to_redeem: loyaltyProgram.min_points_to_redeem,
        points_expiry_days: loyaltyProgram.points_expiry_days,
        only_registered_customers: loyaltyProgram.only_registered_customers,
      });
    }
    setShowLoyaltyDialog(true);
  };


  // Available currencies (not yet added)
  const availableCurrencies = currencies.filter(
    (c) => !orgCurrencies.some((oc) => oc.currency_code === c.code)
  );

  // Primary currency
  const primaryCurrency = orgCurrencies.find((c) => c.is_primary);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-orange-600">
            <Settings className="h-6 w-6 text-orange-500" />
            Paramètres
          </h1>
          <p className="text-gray-500 text-sm">
            Configuration de votre établissement
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="currencies" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Devises
          </TabsTrigger>
          <TabsTrigger value="loyalty" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Fidélité
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Général
          </TabsTrigger>
        </TabsList>

        {/* Currencies Tab */}
        <TabsContent value="currencies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-orange-500" />
                    Gestion des devises
                  </CardTitle>
                  <CardDescription>
                    Configurez les devises acceptées et les taux de change
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddCurrencyDialog(true)} disabled={availableCurrencies.length === 0} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une devise
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orgCurrencies.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Coins className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Aucune devise configurée</p>
                  <p className="text-sm">Ajoutez votre première devise pour commencer</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Devise</TableHead>
                      <TableHead>Symbole</TableHead>
                      <TableHead>Taux de change</TableHead>
                      <TableHead>Dernière mise à jour</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgCurrencies.map((currency) => (
                      <TableRow key={currency.id}>
                        <TableCell className="font-medium text-orange-600">
                          <div className="flex items-center gap-2">
                            {currency.currency_code}
                            {currency.is_primary && (
                              <Badge variant="default" className="bg-orange-500">
                                <Crown className="h-3 w-3 mr-1" />
                                Principal
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">{currency.currency_name}</span>
                        </TableCell>
                        <TableCell>{currency.currency_symbol}</TableCell>
                        <TableCell>
                          {editingRate === currency.id ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">1</span>
                                <Select
                                  value={rateFromCurrency || primaryCurrency?.currency_code || ""}
                                  onValueChange={setRateFromCurrency}
                                >
                                  <SelectTrigger className="w-24 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {orgCurrencies.map((c) => (
                                      <SelectItem key={c.id} value={c.currency_code}>
                                        {c.currency_code}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-sm text-gray-600">=</span>
                                <Input
                                  type="number"
                                  step="0.000001"
                                  value={newRate}
                                  onChange={(e) => setNewRate(e.target.value)}
                                  className="w-28 h-8"
                                  placeholder="Taux"
                                />
                                <Select
                                  value={rateToCurrency || currency.currency_code}
                                  onValueChange={setRateToCurrency}
                                >
                                  <SelectTrigger className="w-24 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {orgCurrencies.map((c) => (
                                      <SelectItem key={c.id} value={c.currency_code}>
                                        {c.currency_code}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateRate(currency.id)}>
                                  <Check className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => {
                                  setEditingRate(null);
                                  setRateFromCurrency("");
                                  setRateToCurrency("");
                                }}>
                                  <X className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {(() => {
                                  const rate = parseFloat(currency.exchange_rate);
                                  if (rate === 0 || isNaN(rate)) return `1 ${currency.currency_code} = ? ${primaryCurrency?.currency_code || "?"}`;
                                  // exchange_rate stocke déjà: 1 devise_secondaire = X devise_principale
                                  return `1 ${currency.currency_code} = ${rate.toFixed(6).replace(/\.?0+$/, '')} ${primaryCurrency?.currency_code || "?"}`;
                                })()}
                              </span>
                              {!currency.is_primary && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingRate(currency.id);
                                    const rate = parseFloat(currency.exchange_rate);
                                    setNewRate(rate !== 0 && !isNaN(rate) ? rate.toString() : "1");
                                    setRateFromCurrency(currency.currency_code);
                                    setRateToCurrency(primaryCurrency?.currency_code || "");
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(currency.last_rate_update).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={currency.is_active ? "default" : "secondary"} className={currency.is_active ? "bg-orange-500" : ""}>
                            {currency.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!currency.is_primary && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500"
                                onClick={() => handleDeleteCurrency(currency.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {currency.is_primary && (
                              <span className="text-xs text-gray-500 italic">Devise par défaut</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Info card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Comment fonctionne la multidevise ?</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>La devise principale a été définie à la création de votre établissement et ne peut plus être modifiée</li>
                    <li>La devise principale est utilisée pour tous les calculs internes</li>
                    <li>Les devises secondaires permettent d&apos;afficher les prix dans d&apos;autres monnaies</li>
                    <li>Pour modifier un taux de change, cliquez sur l&apos;icône d&apos;édition et définissez le taux : <strong>1 devise A = X unités de devise B</strong></li>
                    <li>Vous pouvez définir le taux entre n&apos;importe quelles devises configurées</li>
                    <li>Vous pouvez accepter des paiements dans n&apos;importe quelle devise configurée</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loyalty Tab */}
        <TabsContent value="loyalty" className="space-y-4">
          {/* Loyalty Program Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-orange-500" />
                    Programme de fidélité
                  </CardTitle>
                  <CardDescription>
                    Récompensez vos clients fidèles avec des points
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {loyaltyProgram && (
                    <Button
                      variant={loyaltyProgram.is_active ? "outline" : "default"}
                      onClick={handleToggleLoyalty}
                      className={loyaltyProgram.is_active ? "border-orange-500 text-orange-600 hover:bg-orange-50" : "bg-orange-500 hover:bg-orange-600"}
                    >
                      {loyaltyProgram.is_active ? (
                        <>
                          <ToggleRight className="h-4 w-4 mr-2" />
                          Désactiver
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-4 w-4 mr-2" />
                          Activer
                        </>
                      )}
                    </Button>
                  )}
                  <Button onClick={openLoyaltyDialog} className="bg-orange-500 hover:bg-orange-600">
                    {loyaltyProgram ? (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loyaltyProgram ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Statut</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={loyaltyProgram.is_active ? "default" : "secondary"} className={loyaltyProgram.is_active ? "bg-orange-500" : ""}>
                        {loyaltyProgram.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Calcul des points</div>
                    <div className="font-medium mt-1">
                      {loyaltyProgram.points_calculation_type === "fixed_per_amount"
                        ? `${loyaltyProgram.points_per_unit} pts / ${Number(loyaltyProgram.amount_per_unit).toLocaleString()} ${primaryCurrency?.currency_symbol || "FC"}`
                        : `${loyaltyProgram.points_percentage}% du montant`}
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Valeur d&apos;un point</div>
                    <div className="font-medium mt-1">
                      {Number(loyaltyProgram.point_value).toLocaleString()} {primaryCurrency?.currency_symbol || "FC"}
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Minimum pour utiliser</div>
                    <div className="font-medium mt-1">{loyaltyProgram.min_points_to_redeem} points</div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Expiration</div>
                    <div className="font-medium mt-1">
                      {loyaltyProgram.points_expiry_days > 0
                        ? `${loyaltyProgram.points_expiry_days} jours`
                        : "Jamais"}
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="text-sm text-orange-600 font-medium">Éligibilité</div>
                    <div className="font-medium mt-1">
                      {loyaltyProgram.only_registered_customers
                        ? "Clients enregistrés uniquement"
                        : "Tous les clients"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Gift className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Aucun programme de fidélité configuré</p>
                  <p className="text-sm">Créez un programme pour récompenser vos clients</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          {loyaltyProgram && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Comment utiliser les points de fidélité ?</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Les clients gagnent des points à chaque achat selon la configuration</li>
                      <li>Les points peuvent être utilisés comme de l&apos;argent lors des achats</li>
                      <li>1 point = {Number(loyaltyProgram.point_value).toLocaleString()} {primaryCurrency?.currency_symbol || "FC"}</li>
                      <li>Minimum requis pour utiliser : {loyaltyProgram.min_points_to_redeem} points</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                Paramètres généraux
              </CardTitle>
              <CardDescription>
                Configuration générale de votre établissement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Receipt Settings */}
              <div className="space-y-4">
                <h3 className="font-medium text-orange-600">Reçus</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>En-tête du reçu</Label>
                    <Textarea
                      value={settingsForm.receipt_header}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receipt_header: e.target.value })}
                      placeholder="Texte affiché en haut du reçu"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pied de page du reçu</Label>
                    <Textarea
                      value={settingsForm.receipt_footer}
                      onChange={(e) => setSettingsForm({ ...settingsForm, receipt_footer: e.target.value })}
                      placeholder="Texte affiché en bas du reçu"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Notifications Settings */}
              <div className="space-y-4">
                <h3 className="font-medium text-orange-600">Notifications</h3>
                <div className="space-y-2">
                  <Label>Seuil d&apos;alerte stock bas</Label>
                  <Input
                    type="number"
                    value={settingsForm.low_stock_threshold}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, low_stock_threshold: parseInt(e.target.value) || 0 })
                    }
                    className="max-w-xs"
                  />
                  <p className="text-sm text-gray-500">
                    Alerte lorsque le stock d&apos;un produit descend en dessous de ce seuil
                  </p>
                </div>
              </div>

              {/* Display Settings */}
              <div className="space-y-4">
                <h3 className="font-medium text-orange-600">Affichage sur les reçus</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Afficher les points de fidélité sur les reçus</Label>
                      <p className="text-sm text-gray-500">
                        Affiche les points gagnés et le solde du client sur les reçus/factures
                      </p>
                    </div>
                    <Switch
                      checked={settingsForm.show_loyalty_points_on_receipt}
                      onCheckedChange={(checked) =>
                        setSettingsForm({ ...settingsForm, show_loyalty_points_on_receipt: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Currency Dialog */}
      <Dialog open={showAddCurrencyDialog} onOpenChange={setShowAddCurrencyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une devise</DialogTitle>
            <DialogDescription>
              Sélectionnez une devise à ajouter à votre établissement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner une devise" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.code} - {currency.name} ({currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {orgCurrencies.length > 0 && (
              <div className="space-y-2">
                <Label>Taux de change</Label>
                <div className="flex items-center gap-2">
                  <span>1 {primaryCurrency?.currency_code} =</span>
                  <Input
                    type="number"
                    step="0.000001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="w-32"
                  />
                  <span>{currencies.find((c) => c.id === selectedCurrency)?.code || "?"}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCurrencyDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddCurrency} disabled={!selectedCurrency || isSaving} className="bg-orange-500 hover:bg-orange-600">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loyalty Program Dialog */}
      <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {loyaltyProgram ? "Modifier le programme de fidélité" : "Créer un programme de fidélité"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du programme</Label>
              <Input
                value={loyaltyForm.name}
                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Type de calcul des points</Label>
              <Select
                value={loyaltyForm.points_calculation_type}
                onValueChange={(value: "fixed_per_amount" | "percentage") =>
                  setLoyaltyForm({ ...loyaltyForm, points_calculation_type: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_per_amount">Points fixes par montant</SelectItem>
                  <SelectItem value="percentage">Pourcentage du montant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loyaltyForm.points_calculation_type === "fixed_per_amount" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points gagnés</Label>
                  <Input
                    type="number"
                    value={loyaltyForm.points_per_unit}
                    onChange={(e) =>
                      setLoyaltyForm({ ...loyaltyForm, points_per_unit: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pour chaque montant de ({primaryCurrency?.currency_symbol || "FC"})</Label>
                  <Input
                    type="number"
                    value={loyaltyForm.amount_per_unit}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, amount_per_unit: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Pourcentage du montant converti en points (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={loyaltyForm.points_percentage}
                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, points_percentage: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valeur d&apos;un point ({primaryCurrency?.currency_symbol || "FC"})</Label>
                <Input
                  type="number"
                  step="any"
                  value={loyaltyForm.point_value}
                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, point_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum de points pour utiliser</Label>
                <Input
                  type="number"
                  value={loyaltyForm.min_points_to_redeem}
                  onChange={(e) =>
                    setLoyaltyForm({ ...loyaltyForm, min_points_to_redeem: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expiration des points (jours, 0 = jamais)</Label>
              <Input
                type="number"
                value={loyaltyForm.points_expiry_days}
                onChange={(e) =>
                  setLoyaltyForm({ ...loyaltyForm, points_expiry_days: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Clients enregistrés uniquement</Label>
                <p className="text-sm text-gray-500">
                  Seuls les clients enregistrés peuvent accumuler des points
                </p>
              </div>
              <Switch
                checked={loyaltyForm.only_registered_customers}
                onCheckedChange={(checked) =>
                  setLoyaltyForm({ ...loyaltyForm, only_registered_customers: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoyaltyDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveLoyaltyProgram} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
