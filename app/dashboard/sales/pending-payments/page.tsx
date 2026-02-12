"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DollarSign,
  Loader2,
  Search,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Calendar,
  User,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice, formatDate } from "@/lib/format";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getSales,
  addPaymentToSale,
  getPaymentMethods,
  Sale,
  PaymentMethod,
  AddPaymentData,
} from "@/actions/sales.actions";
import Link from "next/link";

export default function PendingPaymentsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          const [salesResult, methodsResult] = await Promise.all([
            getSales(session.accessToken, org.id, { status: "partially_paid" }),
            getPaymentMethods(session.accessToken, org.id, { is_active: true }),
          ]);

          if (salesResult.success && salesResult.data) {
            setPendingSales(Array.isArray(salesResult.data) ? salesResult.data : (salesResult.data as any).results || []);
          }
          if (methodsResult.success && methodsResult.data) {
            setPaymentMethods(Array.isArray(methodsResult.data) ? methodsResult.data : (methodsResult.data as any).results || []);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session]);


  const openPaymentDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setPaymentAmount(sale.amount_due);
    setSelectedPaymentMethod("");
    setPaymentReference("");
    setShowPaymentDialog(true);
  };

  const handleAddPayment = async () => {
    if (!selectedSale || !session?.accessToken || !organization) return;

    if (!selectedPaymentMethod) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    const amountDue = parseFloat(selectedSale.amount_due);
    if (amount > amountDue) {
      toast.error(`Le montant ne peut pas dépasser ${formatPrice(amountDue)}`);
      return;
    }

    setIsProcessing(true);

    try {
      const paymentData: AddPaymentData = {
        payment_method: selectedPaymentMethod,
        amount: amount,
        reference: paymentReference || undefined,
      };

      const result = await addPaymentToSale(
        session.accessToken,
        organization.id,
        selectedSale.id,
        paymentData
      );

      if (result.success) {
        toast.success("Paiement ajouté avec succès");
        setShowPaymentDialog(false);

        // Refresh the list
        const salesResult = await getSales(session.accessToken, organization.id, {
          status: "partially_paid",
        });
        if (salesResult.success && salesResult.data) {
          setPendingSales(Array.isArray(salesResult.data) ? salesResult.data : (salesResult.data as any).results || []);
        }
      } else {
        toast.error(result.message || "Erreur lors de l'ajout du paiement");
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      toast.error("Erreur lors de l'ajout du paiement");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSales = pendingSales.filter(
    (sale) =>
      sale.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
        <div className="flex items-center gap-2">
          <Link href="/dashboard/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paiements en attente</h1>
            <p className="text-sm text-gray-500 mt-1">
              Ventes partiellement payées nécessitant un paiement complet
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredSales.length}</p>
                <p className="text-xs text-gray-500">Ventes en attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatPrice(
                    filteredSales.reduce((sum, sale) => sum + parseFloat(sale.amount_due), 0)
                  )}
                </p>
                <p className="text-xs text-gray-500">Total à recevoir</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatPrice(
                    filteredSales.reduce((sum, sale) => sum + parseFloat(sale.amount_paid), 0)
                  )}
                </p>
                <p className="text-xs text-gray-500">Déjà payé</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Ventes partiellement payées</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune vente en attente
              </h3>
              <p className="text-sm text-gray-500">
                Toutes les ventes sont entièrement payées
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{sale.reference}</h3>
                      <Badge className="bg-orange-100 text-orange-700">
                        Partiellement payé
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4" />
                        <span>{sale.customer_name || "Client anonyme"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(sale.sale_date)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total: </span>
                        <span className="font-semibold">{formatPrice(sale.total)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Payé: </span>
                        <span className="font-semibold text-green-600">
                          {formatPrice(sale.amount_paid)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Reste à payer</p>
                      <p className="text-xl font-bold text-orange-600">
                        {formatPrice(sale.amount_due)}
                      </p>
                    </div>
                    <Button
                      onClick={() => openPaymentDialog(sale)}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Payer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un paiement</DialogTitle>
            <DialogDescription>
              Vente: {selectedSale?.reference}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Sale Summary */}
            <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total de la vente</span>
                <span className="font-medium">{formatPrice(selectedSale?.total || 0)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Déjà payé</span>
                <span>{formatPrice(selectedSale?.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-300">
                <span>Reste à payer</span>
                <span className="text-orange-600">
                  {formatPrice(selectedSale?.amount_due || 0)}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <SearchableSelect
                options={paymentMethods.map((method) => ({ value: method.id, label: method.name }))}
                value={selectedPaymentMethod || undefined}
                onValueChange={setSelectedPaymentMethod}
                placeholder="Sélectionnez un mode de paiement"
                searchPlaceholder="Rechercher un mode de paiement..."
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Montant à payer (CDF)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="text-lg font-semibold"
                placeholder="0"
                max={selectedSale?.amount_due}
              />
              <p className="text-xs text-gray-500">
                Maximum: {formatPrice(selectedSale?.amount_due || 0)}
              </p>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label>Référence (optionnel)</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Numéro de transaction, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={isProcessing || !selectedPaymentMethod || parseFloat(paymentAmount) <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmer le paiement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
