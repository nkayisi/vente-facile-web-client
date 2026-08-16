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
  // Opération à appliquer pour aller de la devise PAR DÉFAUT vers la NOUVELLE :
  //   "divide"   → montant_new = montant_défaut ÷ taux   (ex. CDF → USD, ÷2800)
  //   "multiply" → montant_new = montant_défaut × taux   (ex. USD → CDF, ×2800)
  // Le marchand saisit toujours un nombre « rond » (2800) et choisit le sens.
  const [rateOp, setRateOp] = useState<"divide" | "multiply">("divide");

  // Édition du taux (même éditeur × / ÷ que l'ajout, dans un dialog)
  const [editingCurrency, setEditingCurrency] = useState<OrganizationCurrency | null>(null);

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

  // Codes pour l'aperçu du taux dans le modal d'ajout.
  const newCurrencyCode = currencies.find((c) => c.id === selectedCurrency)?.code || "?";
  const defaultCode = primaryCurrency?.currency_code || "?";

  // Taux CANONIQUE stocké côté backend = nombre d'unités de la devise PRINCIPALE
  // pour 1 unité de la nouvelle devise. On le dérive du sens choisi + du taux saisi.
  const computeCanonicalRate = (): number | null => {
    const taux = parseFloat(exchangeRate);
    if (!taux || taux <= 0 || isNaN(taux)) return null;
    // op "divide"   : new = def ÷ taux ⇒ 1 new = taux def   ⇒ canonical = taux
    // op "multiply" : new = def × taux ⇒ 1 new = 1/taux def ⇒ canonical = 1/taux
    return rateOp === "divide" ? taux : 1 / taux;
  };

  // Formate un taux en nettoyant le bruit flottant du réciproque : un aller-retour
  // 1/(1/2300) donne 2300.0000016 → on veut afficher « 2300 » exact. toPrecision(9)
  // arrondit ce bruit tout en gardant les vrais taux (ex. 2850.75, 0.000434782609).
  const fmtRate = (n: number): string => {
    if (!isFinite(n) || isNaN(n) || n <= 0) return "?";
    return parseFloat(n.toPrecision(9)).toString();
  };

  // Éditeur de taux réutilisable (ajout ET édition) : sens × / ÷ + montant +
  // aperçu. C'est une fonction de rendu (pas un composant) pour préserver le
  // focus de l'input entre les re-renders. `newCode` = code de la devise cible.
  const renderRateEditor = (newCode: string) => {
    const canonical = computeCanonicalRate();
    const taux = parseFloat(exchangeRate);
    const sample = 100;
    const converted = rateOp === "divide" ? sample / taux : sample * taux;
    return (
      <div className="space-y-3">
        {/* Sens de conversion : de la devise par défaut vers la nouvelle */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500">
            Pour convertir un montant de <strong>{defaultCode}</strong> vers{" "}
            <strong>{newCode}</strong>, on&nbsp;:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRateOp("divide")}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 p-2.5 transition-all ${rateOp === "divide"
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
            >
              <span className="text-lg font-bold">÷ Divise</span>
              <span className="text-[11px] text-gray-500">{newCode} vaut plus que {defaultCode}</span>
            </button>
            <button
              type="button"
              onClick={() => setRateOp("multiply")}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 p-2.5 transition-all ${rateOp === "multiply"
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
            >
              <span className="text-lg font-bold">× Multiplie</span>
              <span className="text-[11px] text-gray-500">{newCode} vaut moins que {defaultCode}</span>
            </button>
          </div>
        </div>

        {/* Taux saisi - formule : montant {défaut} {op} taux → {nouvelle} */}
        <div className="flex items-center gap-2">
          <span className="text-sm whitespace-nowrap">
            Montant {defaultCode} {rateOp === "divide" ? "÷" : "×"}
          </span>
          <Input
            type="number"
            step="0.000001"
            min="0"
            value={exchangeRate}
            onChange={(e) => setExchangeRate(e.target.value)}
            className="w-32"
            placeholder="Ex : 2800"
          />
          <span className="text-sm text-gray-500 whitespace-nowrap">→ {newCode}</span>
        </div>

        {/* Aperçu en direct */}
        {canonical === null || newCode === "?" ? (
          <p className="text-xs text-gray-400">
            Saisissez un taux valide (&gt; 0) pour voir l&apos;équivalence.
          </p>
        ) : (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-1 text-xs text-blue-800">
            <p className="font-medium">Aperçu</p>
            <p>1 {newCode} = <strong>{fmtRate(canonical)}</strong> {defaultCode}</p>
            <p>1 {defaultCode} = <strong>{fmtRate(1 / canonical)}</strong> {newCode}</p>
            <p className="text-blue-600">
              Ex : {sample} {defaultCode} = <strong>{fmtRate(converted)}</strong> {newCode}
            </p>
          </div>
        )}
      </div>
    );
  };

  const resetAddDialog = () => {
    setShowAddCurrencyDialog(false);
    setSelectedCurrency("");
    setExchangeRate("1");
    setRateOp("divide");
  };

  const handleAddCurrency = async () => {
    if (!session?.accessToken || !organization?.id || !selectedCurrency) return;

    const isFirst = orgCurrencies.length === 0;
    // La première devise est la principale : taux forcé à 1 (backend). Sinon on
    // envoie le taux canonique dérivé du sens (× ou ÷) choisi par le marchand.
    let canonicalRate = "1";
    if (!isFirst) {
      const canonical = computeCanonicalRate();
      if (canonical === null) {
        toast.error("Taux invalide");
        return;
      }
      // 12 décimales : indispensable pour les réciproques (ex. principale USD,
      // 1 CDF = 0.000434782609 USD). Tronquer à 6 fausse la conversion.
      canonicalRate = canonical.toFixed(12);
    }

    setIsSaving(true);
    try {
      const result = await addOrganizationCurrency(session.accessToken, organization.id, {
        currency: selectedCurrency,
        exchange_rate: canonicalRate,
        is_primary: isFirst,
      });
      if (result.success) {
        toast.success("Devise ajoutée avec succès");
        resetAddDialog();
        loadData();
      } else {
        toast.error(result.message || "Erreur lors de l'ajout");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Ouvre le dialog d'édition en pré-remplissant le sens (× / ÷) et le taux
  // « naturel » déduits du taux canonique stocké (principale par unité).
  const openEditRate = (currency: OrganizationCurrency) => {
    const canonical = parseFloat(currency.exchange_rate);
    if (canonical >= 1) {
      // 1 {code} = canonical {défaut} ⇒ défaut→code : on DIVISE par canonical.
      setRateOp("divide");
      setExchangeRate(fmtRate(canonical));
    } else if (canonical > 0) {
      // 1 {défaut} = 1/canonical {code} ⇒ défaut→code : on MULTIPLIE.
      // fmtRate nettoie le bruit du réciproque pour ré-afficher un taux « rond ».
      setRateOp("multiply");
      setExchangeRate(fmtRate(1 / canonical));
    } else {
      setRateOp("multiply");
      setExchangeRate("1");
    }
    setEditingCurrency(currency);
  };

  const closeEditRate = () => {
    setEditingCurrency(null);
    setExchangeRate("1");
    setRateOp("divide");
  };

  const handleUpdateRate = async () => {
    if (!session?.accessToken || !organization?.id || !editingCurrency) return;

    const canonical = computeCanonicalRate();
    if (canonical === null) {
      toast.error("Taux invalide");
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateExchangeRate(
        session.accessToken,
        organization.id,
        editingCurrency.id,
        canonical.toFixed(12)
      );
      if (result.success) {
        toast.success("Taux de change mis à jour");
        closeEditRate();
        loadData();
      } else {
        toast.error(result.message || "Erreur");
      }
    } finally {
      setIsSaving(false);
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {(() => {
                            const rate = parseFloat(currency.exchange_rate);
                            const primaryCode = primaryCurrency?.currency_code || "?";
                            if (currency.is_primary) {
                              return `Devise principale`;
                            }
                            if (rate === 0 || isNaN(rate)) {
                              return `1 ${currency.currency_code} = ? ${primaryCode}`;
                            }
                            // Affiche le sens « naturel » (nombre lisible) : si la
                            // devise vaut moins que la principale (rate < 1), on
                            // montre « 1 {principale} = X {code} ».
                            if (rate < 1) {
                              return `1 ${primaryCode} = ${fmtRate(1 / rate)} ${currency.currency_code}`;
                            }
                            return `1 ${currency.currency_code} = ${fmtRate(rate)} ${primaryCode}`;
                          })()}
                        </span>
                        {!currency.is_primary && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditRate(currency)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
                <li>Les devises secondaires permettent d&apos;afficher les prix et d&apos;encaisser dans d&apos;autres monnaies</li>
                <li>
                  Le taux se lit toujours&nbsp;: <strong>1 devise secondaire = X unités de la devise principale</strong>{" "}
                  (ex. 1 USD = 2800 CDF)
                </li>
                <li>
                  <strong>Conversion</strong> : vers la devise principale on <strong>multiplie</strong> par le taux ;
                  depuis la devise principale on <strong>divise</strong> par le taux
                </li>
                <li>Pour modifier un taux, cliquez sur l&apos;icône d&apos;édition</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Currency Dialog */}
      <Dialog open={showAddCurrencyDialog} onOpenChange={(open) => { if (!open) resetAddDialog(); else setShowAddCurrencyDialog(true); }}>
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
              <div className="space-y-3">
                <Label>Taux de change</Label>
                {renderRateEditor(newCurrencyCode)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAddDialog}>
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

      {/* Edit Rate Dialog */}
      <Dialog open={!!editingCurrency} onOpenChange={(open) => { if (!open) closeEditRate(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Modifier le taux - {editingCurrency?.currency_code}
            </DialogTitle>
            <DialogDescription>
              Ajustez le taux de change entre {defaultCode} et {editingCurrency?.currency_code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editingCurrency && renderRateEditor(editingCurrency.currency_code)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditRate}>
              Annuler
            </Button>
            <Button
              onClick={handleUpdateRate}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
