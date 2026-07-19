"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Coins,
  Plus,
  Trash2,
  Edit,
  Check,
  X,
  Crown,
  Loader2,
  Info,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

import { useOrganization } from "@/components/auth/organization-checker";
import {
  Currency,
  OrganizationCurrency,
  getCurrencies,
  getOrganizationCurrencies,
  addOrganizationCurrency,
  deleteOrganizationCurrency,
  updateExchangeRate,
} from "@/actions/settings.actions";

export default function CurrenciesSettingsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Ajout de devise
  const [showAddCurrencyDialog, setShowAddCurrencyDialog] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState("1");

  // Édition du taux
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const [rateFromCurrency, setRateFromCurrency] = useState<string>("");
  const [rateToCurrency, setRateToCurrency] = useState<string>("");

  const loadData = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    setIsLoading(true);
    try {
      const [currenciesRes, orgCurrenciesRes] = await Promise.all([
        getCurrencies(session.accessToken),
        getOrganizationCurrencies(session.accessToken, organization.id),
      ]);
      if (currenciesRes.success && currenciesRes.data) {
        setCurrencies(currenciesRes.data);
      }
      if (orgCurrenciesRes.success && orgCurrenciesRes.data) {
        setOrgCurrencies(Array.isArray(orgCurrenciesRes.data) ? orgCurrenciesRes.data : []);
      }
    } catch (error) {
      console.error("Error loading currencies:", error);
      toast.error("Erreur lors du chargement des devises");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Devise principale + devises disponibles à l'ajout
  const primaryCurrency = orgCurrencies.find((c) => c.is_primary);
  const availableCurrencies = currencies.filter(
    (c) => !orgCurrencies.some((oc) => oc.currency_code === c.code)
  );

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

  const handleUpdateRate = async (currencyId: string) => {
    if (!session?.accessToken || !organization?.id || !newRate) return;

    const rateValue = parseFloat(newRate);
    if (!rateValue || rateValue <= 0 || isNaN(rateValue)) {
      toast.error("Taux invalide");
      return;
    }

    // Convention canonique du backend :
    //   exchange_rate(X) = nombre d'unités de X pour 1 unité de la devise principale.
    //   (cf. backend/apps/settings/views.py : amount_in_primary = amount / from.exchange_rate)
    //   Ex : primaire USD, CDF.exchange_rate = 2300  ⇒  1 USD = 2300 CDF.
    //
    // L'utilisateur saisit "1 fromCurr = rateValue toCurr". On recalcule
    // l'exchange_rate de la devise de la ligne (rowCurr) à partir des taux connus.
    const rowCurr = orgCurrencies.find((c) => c.id === currencyId);
    if (!rowCurr) return;

    const exch = (c?: OrganizationCurrency) =>
      c?.is_primary ? 1 : parseFloat(c?.exchange_rate ?? "0");

    const fromCurr = orgCurrencies.find((c) => c.currency_code === rateFromCurrency);
    const toCurr = orgCurrencies.find((c) => c.currency_code === rateToCurrency);

    let finalRate: number;
    if (fromCurr && toCurr && fromCurr.currency_code !== toCurr.currency_code) {
      if (toCurr.id === rowCurr.id) {
        // 1 from = rateValue row  ⇒  exch(row) = rateValue * exch(from)
        finalRate = rateValue * exch(fromCurr);
      } else if (fromCurr.id === rowCurr.id) {
        // 1 row = rateValue to  ⇒  exch(row) = exch(to) / rateValue
        finalRate = exch(toCurr) / rateValue;
      } else {
        // Aucune des devises choisies n'est celle de la ligne : on interprète
        // la valeur comme "1 principale = rateValue ligne".
        finalRate = rateValue;
      }
    } else {
      finalRate = rateValue;
    }

    if (!finalRate || finalRate <= 0 || !isFinite(finalRate)) {
      toast.error("Taux invalide");
      return;
    }

    const result = await updateExchangeRate(
      session.accessToken,
      organization.id,
      currencyId,
      finalRate.toString()
    );
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <Button
              onClick={() => setShowAddCurrencyDialog(true)}
              disabled={availableCurrencies.length === 0}
              className="bg-orange-500 hover:bg-orange-600"
            >
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingRate(null);
                                setRateFromCurrency("");
                                setRateToCurrency("");
                              }}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {(() => {
                              const rate = parseFloat(currency.exchange_rate);
                              const primaryCode = primaryCurrency?.currency_code || "?";
                              if (currency.is_primary) {
                                return `Devise principale`;
                              }
                              if (rate === 0 || isNaN(rate)) {
                                return `1 ${primaryCode} = ? ${currency.currency_code}`;
                              }
                              // exchange_rate = nb d'unités de cette devise pour 1 unité de la principale
                              // ⇒ « 1 {principale} = {taux} {cette devise} »
                              return `1 ${primaryCode} = ${rate
                                .toFixed(6)
                                .replace(/\.?0+$/, "")} ${currency.currency_code}`;
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
                                // Défaut cohérent avec l'affichage : « 1 principale = taux ligne »
                                setRateFromCurrency(primaryCurrency?.currency_code || "");
                                setRateToCurrency(currency.currency_code);
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
                      <Badge
                        variant={currency.is_active ? "default" : "secondary"}
                        className={currency.is_active ? "bg-orange-500" : ""}
                      >
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
                <li>La devise principale est utilisée pour tous les calculs internes</li>
                <li>Les devises secondaires permettent d&apos;afficher les prix dans d&apos;autres monnaies</li>
                <li>
                  Le taux se lit toujours&nbsp;: <strong>1 devise principale = X unités de la devise secondaire</strong>
                </li>
                <li>Pour modifier un taux, cliquez sur l&apos;icône d&apos;édition</li>
                <li>Vous pouvez accepter des paiements dans n&apos;importe quelle devise configurée</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Button
              onClick={handleAddCurrency}
              disabled={!selectedCurrency || isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
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
    </div>
  );
}
