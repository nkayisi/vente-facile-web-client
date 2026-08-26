"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  DollarSign,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShoppingCart,
  Trash2,
  User,
  Calendar,
  FileText,
  TrendingUp,
  Wallet,
  History,
  Banknote,
  AlertTriangle,
  Settings,
  Receipt,
  Smartphone,
  CheckCircle,
  CircleDollarSign,
  Check,
  Printer,
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
import { formatPoints, formatPrice, formatDateTime } from "@/lib/format";
import { useCurrency } from "@/components/providers/currency-provider";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getCustomer,
  deleteCustomer,
  updateCustomer,
  getCustomerTransactions,
  redeemCustomerPointsToDebt,
  Customer,
  CustomerTransaction,
} from "@/actions/contacts.actions";
import {
  getSale,
  getSales,
  addPaymentToSale,
  getPaymentMethods,
  Sale,
  PaymentMethod,
} from "@/actions/sales.actions";
import {
  buildPaymentReceipt,
  type PaymentReceiptData,
} from "@/lib/receipt";
import { useReceiptChrome } from "@/hooks/use-receipt-chrome";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";
import {
  getCustomerLoyalty,
  getCustomerLoyaltyTransactions,
  getLoyaltyProgram,
  getOrganizationCurrencies,
  CustomerLoyalty,
  LoyaltyProgram,
  LoyaltyTransaction,
  OrganizationCurrency,
} from "@/actions/settings.actions";
import { Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { LoyaltyPointsPicker } from "@/components/sales/loyalty-points-picker";
import { createMoneyHelpers, MONEY_EPS } from "@/lib/currency";
import { isOverdue, dueDateLabel } from "@/lib/due-date";

/**
 * Arrondi d'une saisie de points au centième.
 *
 * Les points sont fractionnaires : tronquer à l'entier interdisait au client
 * d'utiliser le solde qu'il vient de gagner (0,58 point devenait 0).
 */
function roundPoints(value: number): number {
  return Math.floor(value * 100) / 100;
}

export default function CustomerDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const { currency: defaultCurrency } = useCurrency();

  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const { chrome, paperWidth } = useReceiptChrome(session?.accessToken, organization);
  const printer = useReceiptPrinter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [isLoadingTxns, setIsLoadingTxns] = useState(false);
  const [txnFilter, setTxnFilter] = useState<string>("all");

  // Credit limit dialog
  const [showCreditLimitDialog, setShowCreditLimitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creditLimitValue, setCreditLimitValue] = useState("");
  const [allowCreditValue, setAllowCreditValue] = useState(true);

  // Loyalty points
  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyalty | null>(null);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);

  // Invoice payment dialog
  const [showInvoicePaymentDialog, setShowInvoicePaymentDialog] = useState(false);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [invoicePaymentAmount, setInvoicePaymentAmount] = useState("");
  const [invoicePaymentRef, setInvoicePaymentRef] = useState("");
  // Points de fidélité utilisés sur cette facture (cumulables avec l'argent).
  const [invoicePointsUsed, setInvoicePointsUsed] = useState("");
  // Ouverture du popover de saisie des points, comme au POS : le panneau
  // déplié coûtait cinq lignes en permanence pour un geste occasionnel.
  const [showInvoicePointsPicker, setShowInvoicePointsPicker] = useState(false);
  // Utilisation des points sur la dette globale du client.
  const [showRedeemDebtDialog, setShowRedeemDebtDialog] = useState(false);
  const [debtPointsUsed, setDebtPointsUsed] = useState("");
  // Multi-devise : devise du règlement + taux org (conversion & validation).
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [invoicePaymentCurrency, setInvoicePaymentCurrency] = useState<string>("");

  // Dérivations du solde, calculées AVANT les gestionnaires qui les capturent
  // et avant les `return` anticipés (chargement, client introuvable).
  const balance = parseFloat(customer?.current_balance ?? "0") || 0;
  // Dette RÉELLE, devise par devise. `current_balance` n'en est que la somme
  // convertie en devise principale : on n'affiche jamais un total qui mélange
  // 50 USD et 40 000 CDF sans le dire.
  const balanceLines = (customer?.balances || []).filter(
    (b) => parseFloat(b.amount) !== 0
  );

  const money = useMemo(
    () => createMoneyHelpers(orgCurrencies, defaultCurrency),
    [orgCurrencies, defaultCurrency]
  );

  // --- Règlement en points ------------------------------------------------
  //
  // Déclaré ICI, avant les `return` anticipés (chargement, client introuvable) :
  // `handleInvoicePayment` capture ces valeurs dans sa closure, et les laisser
  // plus bas les mettrait en zone morte temporelle sur les rendus qui sortent
  // tôt.
  //
  // Le barème (`point_value`) est libellé en devise principale : on ne propose
  // donc les points que sur une facture dans cette même devise.
  const availablePoints = customerLoyalty?.current_points ?? 0;
  const pointValue = parseFloat(loyaltyProgram?.point_value ?? "0");
  const minPointsToRedeem = loyaltyProgram?.min_points_to_redeem ?? 0;
  const canUsePointsOnInvoice =
    !!loyaltyProgram?.is_active &&
    availablePoints > 0 &&
    pointValue > 0 &&
    selectedSale?.currency === defaultCurrency.code;

  /**
   * Part de la facture réglable en points, telle que le SERVEUR l'autorise.
   *
   * `loyalty_max_redeemable` applique `max_redemption_percent` - lui-même
   * re-borné par un plafond dur de 70 % côté serveur - et retranche ce qui a
   * déjà été réglé en points. Le calculer ici sur le seul reste à payer, comme
   * avant, proposait un maximum que `resolve_redemption` refusait ensuite.
   *
   * Repli à 0 tant que le détail de la facture n'est pas revenu : mieux vaut un
   * panneau momentanément inerte qu'un nombre que le serveur rejettera.
   */
  const maxRedeemableAmount = parseFloat(
    selectedSale?.loyalty_max_redeemable ?? "0"
  ) || 0;
  const maxUsablePoints = canUsePointsOnInvoice
    ? Math.min(availablePoints, roundPoints(maxRedeemableAmount / pointValue))
    : 0;
  // En dessous du minimum du programme, le serveur n'accorde AUCUNE remise :
  // le panneau doit le dire plutôt qu'offrir un champ sans effet.
  const pointsRedeemable = maxUsablePoints >= minPointsToRedeem && maxUsablePoints > 0;
  const enteredPoints = parseFloat(invoicePointsUsed) || 0;
  // Miroir de `calculateLoyaltyDiscount` au POS : sous le minimum la valeur est
  // nulle, et elle ne dépasse jamais la part autorisée.
  const pointsValue =
    enteredPoints >= minPointsToRedeem
      ? Math.min(enteredPoints * pointValue, maxRedeemableAmount)
      : 0;

  /**
   * Montant saisi, exprimé dans la devise de la FACTURE.
   *
   * Passe par `money.convMoney`, comme le POS et la page des paiements en
   * attente. La version locale de cette page ne faisait que la division des
   * taux, **sans arrondir aux décimales de la devise cible** : 20 USD sur une
   * facture en CDF donnait 45 999,999... et le contrôle « le règlement ne peut
   * pas dépasser le restant dû » se jouait sur des centièmes fantômes.
   */
  const invToSaleCurrency = (amount: number) => {
    if (!selectedSale || !invoicePaymentCurrency) return amount;
    return money.convMoney(amount, invoicePaymentCurrency, selectedSale.currency);
  };

  /** Icône d'un moyen de paiement, identique à celle du POS. */
  const methodIcon = (type: PaymentMethod["method_type"]) => {
    switch (type) {
      case "cash": return <Banknote className="h-5 w-5" />;
      case "mobile_money": return <Smartphone className="h-5 w-5" />;
      case "card":
      case "bank_transfer": return <CreditCard className="h-5 w-5" />;
      default: return <CircleDollarSign className="h-5 w-5" />;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.accessToken) return;

      try {
        const orgResult = await getUserOrganizations(session.accessToken);
        if (orgResult.success && orgResult.data && orgResult.data.length > 0) {
          const org = orgResult.data[0];
          setOrganization(org);

          // Les devises font partie du chargement initial, et non d'un fetch
          // paresseux déclenché par l'ouverture d'une modale : sans elles tous
          // les taux valent 1, les symboles sont remplacés par les codes, et le
          // sélecteur de devise des opérations de solde reste vide, donc
          // inutilisable. Elles sont nécessaires dès le premier montant affiché.
          const currenciesResult = await getOrganizationCurrencies(
            session.accessToken, org.id
          );
          if (currenciesResult.success && currenciesResult.data) {
            setOrgCurrencies(currenciesResult.data);
          }

          const result = await getCustomer(session.accessToken, org.id, customerId);
          if (result.success && result.data) {
            setCustomer(result.data);

            // Charger les points de fidélité du client
            const [loyaltyResult, programResult] = await Promise.all([
              getCustomerLoyalty(session.accessToken, org.id, customerId),
              getLoyaltyProgram(session.accessToken, org.id),
            ]);

            if (loyaltyResult.success && loyaltyResult.data) {
              setCustomerLoyalty(loyaltyResult.data);
              const txnsResult = await getCustomerLoyaltyTransactions(
                session.accessToken, org.id, loyaltyResult.data.id
              );
              if (txnsResult.success && txnsResult.data) {
                setLoyaltyTransactions(txnsResult.data);
              }
            }

            if (programResult.success) {
              if (programResult.data) {
                setLoyaltyProgram(programResult.data);
              }
            } else {
              console.error('[Customer Detail] Failed to load loyalty program:', programResult.message);
            }
          } else {
            toast.error("Client non trouvé");
            router.push("/dashboard/contacts/customers");
          }
        }
      } catch (error) {
        toast.error("Erreur lors du chargement");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken, customerId]);

  // Refresh all data (customer + transactions)
  const refreshData = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    try {
      const result = await getCustomer(session.accessToken, organization.id, customerId);
      if (result.success && result.data) {
        setCustomer(result.data);
      }
    } catch (error) {
      console.error("Error refreshing customer:", error);
    }
  }, [session?.accessToken, organization, customerId]);

  // Load pending sales for this customer
  const loadPendingSales = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    try {
      // `page_size` explicite : sans lui, seule la première page DRF était
      // concaténée et le total des factures ouvertes affiché était faux dès
      // qu'un client dépassait la taille de page par défaut.
      const [partiallyPaidResult, pendingResult, methodsResult] = await Promise.all([
        getSales(session.accessToken, organization.id, {
          status: "partially_paid", customer: customerId, page_size: 200,
        }),
        getSales(session.accessToken, organization.id, {
          status: "pending", customer: customerId, page_size: 200,
        }),
        getPaymentMethods(session.accessToken, organization.id, { is_active: true }),
      ]);

      // Un échec ne doit pas faire disparaître les factures en silence : la
      // carte « Factures en attente » se masque quand la liste est vide, et le
      // client semblait alors ne rien devoir.
      if (!partiallyPaidResult.success || !pendingResult.success) {
        toast.warning(
          "Factures en attente non chargées - la liste peut être incomplète."
        );
      }

      const allSales = [
        ...(Array.isArray(partiallyPaidResult.data) ? partiallyPaidResult.data : (partiallyPaidResult.data as any)?.results || []),
        ...(Array.isArray(pendingResult.data) ? pendingResult.data : (pendingResult.data as any)?.results || [])
      ];
      setPendingSales(allSales);

      if (methodsResult.success && methodsResult.data) {
        setPaymentMethods(Array.isArray(methodsResult.data) ? methodsResult.data : (methodsResult.data as any).results || []);
      }
    } catch (error) {
      console.error("Error loading pending sales:", error);
    }
  }, [session?.accessToken, organization, customerId]);

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    setIsLoadingTxns(true);
    try {
      const typeParam = txnFilter === "all" ? undefined : txnFilter;
      const result = await getCustomerTransactions(
        session.accessToken, organization.id, customerId, typeParam
      );
      if (result.success && result.data) {
        setTransactions(result.data);
      } else {
        // Sans ce message, un échec affichait « Aucun mouvement » : impossible
        // de distinguer un client sans historique d'une requête en erreur.
        setTransactions([]);
        toast.warning("Historique des mouvements non chargé.");
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setIsLoadingTxns(false);
    }
  }, [session?.accessToken, organization, customerId, txnFilter]);

  // Dépendre de l'IDENTIFIANT du client, pas de l'objet : `refreshData()`
  // remplace l'objet `customer` après chaque opération, ce qui re-déclenchait
  // cet effet et doublait les requêtes déjà lancées explicitement par les
  // handlers (quatre appels réseau au lieu de deux).
  const customerLoaded = customer?.id;
  useEffect(() => {
    if (organization && customerLoaded) {
      loadTransactions();
      loadPendingSales();
    }
  }, [organization, customerLoaded, txnFilter, loadTransactions, loadPendingSales]);

  // Handle invoice payment
  const handleInvoicePayment = async () => {
    if (!session?.accessToken || !organization || !customer || !selectedSale) return;

    const pointsUsed = parseFloat(invoicePointsUsed) || 0;
    const amount = parseFloat(invoicePaymentAmount) || 0;

    // Une facture peut être réglée uniquement en points, uniquement en argent,
    // ou par un mélange des deux.
    if (amount <= 0 && pointsUsed <= 0) {
      toast.error("Indiquez un montant ou un nombre de points à utiliser");
      return;
    }
    if (amount > 0 && !selectedPaymentMethod) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }
    // Miroirs des deux refus de `resolve_redemption` : sans eux le caissier
    // encaissait, attendait l'impression, et recevait « Points inutilisables ».
    if (pointsUsed > 0 && pointsUsed < minPointsToRedeem) {
      toast.error(
        `Il faut utiliser au moins ${formatPoints(minPointsToRedeem)} points.`
      );
      return;
    }
    if (pointsUsed > maxUsablePoints) {
      toast.error(
        `${formatPoints(maxUsablePoints)} points au maximum sur cette facture ` +
        `(${formatPrice(maxRedeemableAmount)}).`
      );
      return;
    }

    const amountDue = parseFloat(selectedSale.amount_due) || 0;
    // Le restant dû est en devise de la vente : comparer la valeur convertie,
    // déduction faite de ce que les points couvrent déjà.
    const amountInSale = amount > 0 ? invToSaleCurrency(amount) : 0;
    // Même borne que le serveur : au-delà du plafond, les points ne couvrent
    // pas davantage, et compter la valeur brute sous-estimerait l'argent dû.
    const coveredByPoints = Math.min(pointsUsed * pointValue, maxRedeemableAmount);
    // Tolérance d'arrondi partagée avec l'affichage, et montant libellé dans la
    // devise de la facture : `formatPrice` seul y collait le symbole de la
    // devise principale, puis le code de la facture était ajouté derrière -
    // une facture de 50 USD s'annonçait « 50 FC USD ».
    if (amountInSale + coveredByPoints > amountDue + MONEY_EPS) {
      toast.error(
        `Le règlement ne peut pas dépasser ${money.money(amountDue, selectedSale.currency)}`
      );
      return;
    }

    const job = printer.begin();
    setIsSubmitting(true);
    try {
      const result = await addPaymentToSale(
        session.accessToken,
        organization.id,
        selectedSale.id,
        {
          ...(amount > 0
            ? {
                payment_method: selectedPaymentMethod,
                amount,
                ...(invoicePaymentCurrency && invoicePaymentCurrency !== selectedSale.currency
                  ? { currency: invoicePaymentCurrency }
                  : {}),
              }
            : {}),
          ...(pointsUsed > 0 ? { points_used: pointsUsed } : {}),
          reference: invoicePaymentRef || undefined,
        }
      );

      if (result.success) {
        const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
        // Repli à 0 : ces montants partent sur le reçu PDF, où un `NaN`
        // s'imprimerait tel quel.
        const previouslyPaid = parseFloat(selectedSale.amount_paid) || 0;
        const remainingBalance = amountDue - amountInSale - coveredByPoints;

        // Numéro du serveur, porté par le règlement créé : une réimpression
        // rend le même, ce que `PAY-${Date.now()}` ne pouvait pas garantir.
        const settledPayment = result.data?.payments?.[result.data.payments.length - 1];

        const receiptData: PaymentReceiptData = {
          kind: "debt_payment",
          chrome: chrome ?? { org: { name: organization.name || "Vente Facile" } },
          number: settledPayment?.receipt_number || selectedSale.reference,
          date: new Date().toLocaleString("fr-CD"),
          customerName: customer.name,
          customerPhone: customer.phone || undefined,
          paymentMethod: selectedMethod?.name || "Espèces",
          paymentReference: invoicePaymentRef || undefined,
          // Ces montants sont en devise de la FACTURE : y annoncer la devise
          // principale donnait un reçu où quatre montants portaient deux
          // référentiels différents.
          amountPaid: amountInSale + coveredByPoints,
          currency: selectedSale.currency,
          invoice: {
            reference: selectedSale.reference,
            total: parseFloat(selectedSale.total) || 0,
            previouslyPaid,
            remaining: remainingBalance,
            currency: selectedSale.currency,
          },
          debt: {
            before: amountDue,
            after: remainingBalance,
            currency: selectedSale.currency,
          },
          // Valeurs autoritatives de la vente rafraîchie : le règlement a pu
          // être fait en points.
          loyalty: {
            show: !!result.data?.loyalty_program_active,
            used: result.data?.loyalty_points_used ?? 0,
            balance: result.data?.loyalty_points_balance ?? 0,
          },
        };

        job.present(buildPaymentReceipt(receiptData), {
          filename: `reglement-${selectedSale.reference}.pdf`,
          paperWidth,
          successMessage: "Paiement enregistré",
        });

        closeInvoicePaymentDialog();

        // Refresh data
        await refreshData();
        loadTransactions();
        loadPendingSales();
      } else {
        job.abort();
        toast.error(result.message || "Erreur lors de l'ajout du paiement");
      }
    } catch (error) {
      job.abort();
      console.error("Error adding payment:", error);
      toast.error("Erreur lors de l'ajout du paiement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Utilise les points du client pour éponger sa dette. Le backend convertit
  // les points en montant puis l'impute sur les factures ouvertes.
  const handleRedeemPointsToDebt = async () => {
    if (!session?.accessToken || !organization || !customer) return;

    const points = parseFloat(debtPointsUsed) || 0;
    if (points <= 0) {
      toast.error("Indiquez un nombre de points");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await redeemCustomerPointsToDebt(
        session.accessToken,
        organization.id,
        customer.id,
        { points }
      );

      if (result.success && result.data) {
        const { points_used, amount, settled_invoices } = result.data;
        toast.success(`${points_used} points utilisés`, {
          description: settled_invoices.length
            ? `${formatPrice(amount)} imputés sur : ${settled_invoices.join(", ")}`
            : `${formatPrice(amount)} déduits de la dette`,
        });
        setShowRedeemDebtDialog(false);
        setDebtPointsUsed("");

        await refreshData();
        loadTransactions();
        loadPendingSales();
        const loyaltyResult = await getCustomerLoyalty(
          session.accessToken, organization.id, customer.id
        );
        if (loyaltyResult.success && loyaltyResult.data) {
          setCustomerLoyalty(loyaltyResult.data);
          const txnsResult = await getCustomerLoyaltyTransactions(
            session.accessToken, organization.id, loyaltyResult.data.id
          );
          if (txnsResult.success && txnsResult.data) {
            setLoyaltyTransactions(txnsResult.data);
          }
        }
      } else {
        toast.error(result.message || "Erreur lors de l'utilisation des points");
      }
    } catch (error) {
      console.error("Error redeeming points:", error);
      toast.error("Erreur lors de l'utilisation des points");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInvoicePaymentDialog = async (sale: Sale) => {
    const saleCurrency = sale.currency || defaultCurrency.code;
    setSelectedSale(sale);
    // Le règlement s'ouvre dans la devise de la facture : montant et devise
    // partent donc du même référentiel. C'est `changeInvoicePaymentCurrency`
    // qui reconvertit ensuite si le caissier encaisse dans une autre devise.
    setInvoicePaymentCurrency(saleCurrency);
    // Champ VIDE : le caissier saisit ce qu'il a réellement reçu. Pré-remplir
    // au reste dû faisait valider un solde complet d'un simple clic, alors que
    // la plupart des règlements sur facture sont partiels.
    setInvoicePaymentAmount("");
    // Définir Espèces comme méthode par défaut
    const cashMethod = paymentMethods.find(m => m.method_type === "cash");
    setSelectedPaymentMethod(cashMethod?.id || "");
    setInvoicePaymentRef("");
    setInvoicePointsUsed("");
    setShowInvoicePointsPicker(false);
    setShowInvoicePaymentDialog(true);

    // La facture vient de la LISTE, qui ne porte pas les champs de fidélité :
    // sans ce second appel, la part réglable en points serait inconnue et le
    // panneau proposerait un maximum que le serveur refuserait. On relit donc
    // le détail, seule source du plafond réellement appliqué.
    if (!session?.accessToken || !organization) return;
    const detail = await getSale(session.accessToken, organization.id, sale.id);
    if (detail.success && detail.data) {
      setSelectedSale((current) =>
        current?.id === sale.id ? detail.data! : current
      );
    }
  };

  /**
   * Change la devise d'encaissement en conservant la VALEUR saisie.
   *
   * Les boutons de devise ne faisaient que changer l'étiquette : le nombre
   * restait tel quel. Sur une facture de 15 029,86 $ basculée en CDF, le champ
   * proposait « 15 029,86 FC », soit 6,53 $ - confirmer réglait 6,53 $ sur une
   * facture de 15 029,86 $. Même geste qu'au POS, qui ré-exprime le montant
   * reçu dans la nouvelle devise.
   */
  const changeInvoicePaymentCurrency = (next: string) => {
    const current = parseFloat(invoicePaymentAmount);
    if (invoicePaymentCurrency && !isNaN(current) && current > 0) {
      setInvoicePaymentAmount(
        String(money.convMoney(current, invoicePaymentCurrency, next))
      );
    }
    setInvoicePaymentCurrency(next);
  };

  /** Referme la modale de règlement et remet tous ses champs à zéro. */
  const closeInvoicePaymentDialog = () => {
    setShowInvoicePaymentDialog(false);
    setSelectedSale(null);
    setSelectedPaymentMethod("");
    setInvoicePaymentAmount("");
    setInvoicePaymentRef("");
    setInvoicePointsUsed("");
    setShowInvoicePointsPicker(false);
    // Oublié du bloc de reset d'origine : la devise du règlement précédent
    // restait en place et s'appliquait à la facture suivante.
    setInvoicePaymentCurrency("");
  };

  const handleUpdateCreditLimit = async () => {
    if (!session?.accessToken || !organization || !customer) return;
    const newLimit = parseFloat(creditLimitValue);
    if (isNaN(newLimit) || newLimit < 0) {
      toast.error("Le montant doit être 0 ou plus");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateCustomer(
        session.accessToken, organization.id, customer.id,
        { credit_limit: newLimit, allow_credit: allowCreditValue }
      );
      if (result.success) {
        toast.success("Conditions de crédit mises à jour");
        setShowCreditLimitDialog(false);
        await refreshData();
      } else {
        toast.error(result.message || "Erreur");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Ouvre la modale des conditions de crédit avec l'état RÉEL du client.
   *
   * Il existait deux entrées et une seule chargeait `allowCreditValue`. Ouvrir
   * par le bouton du header laissait l'interrupteur sur sa valeur initiale
   * (`true`), et `handleUpdateCreditLimit` envoie `allow_credit` : enregistrer
   * réactivait donc silencieusement le crédit d'un client à qui il avait été
   * refusé. Les deux entrées passent désormais par ici.
   */
  const openCreditLimitDialog = () => {
    if (!customer) return;
    setCreditLimitValue(customer.credit_limit || "0");
    setAllowCreditValue(customer.allow_credit);
    setShowCreditLimitDialog(true);
  };

  const handleDelete = async () => {
    if (!session?.accessToken || !organization || !customer) return;

    setIsDeleting(true);
    try {
      const result = await deleteCustomer(session.accessToken, organization.id, customer.id);
      if (result.success) {
        toast.success("Client supprimé avec succès");
        router.push("/dashboard/contacts/customers");
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsDeleting(false);
    }
  };

  const getTxnIcon = (type: string) => {
    switch (type) {
      case "credit_sale": return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "payment": return <CreditCard className="h-4 w-4 text-green-500" />;
      case "advance": return <Banknote className="h-4 w-4 text-blue-500" />;
      case "adjustment": return <DollarSign className="h-4 w-4 text-orange-500" />;
      case "refund": return <ArrowUpRight className="h-4 w-4 text-purple-500" />;
      default: return <DollarSign className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTxnColor = (type: string) => {
    switch (type) {
      case "credit_sale": return "text-red-600";
      case "payment": return "text-green-600";
      case "advance": return "text-blue-600";
      case "adjustment": return "text-orange-600";
      case "refund": return "text-purple-600";
      default: return "text-gray-600";
    }
  };

  const getTxnSign = (type: string) => {
    return type === "credit_sale" || type === "refund" ? "+" : "-";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Client non trouvé</h3>
        <Link href="/dashboard/contacts/customers">
          <Button variant="outline">Retour aux clients</Button>
        </Link>
      </div>
    );
  }

  const isMultiCurrencyDebt = balanceLines.length > 1;

  // Dette épongeable par les points : elle est libellée en devise principale,
  // comme le barème.
  const primaryDebt = parseFloat(
    balanceLines.find((b) => b.currency === defaultCurrency.code)?.amount || "0"
  );
  const maxPointsForDebt =
    pointValue > 0 && primaryDebt > 0
      ? Math.min(availablePoints, roundPoints(primaryDebt / pointValue))
      : 0;
  const debtPointsValue = (parseFloat(debtPointsUsed) || 0) * pointValue;
  const creditLimit = parseFloat(customer.credit_limit);
  const availableCredit = parseFloat(customer.available_credit || "0");
  const totalPurchases = parseFloat(customer.total_purchases || "0");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/contacts/customers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${customer.customer_type === "business" ? "bg-purple-100" : "bg-blue-100"}`}>
              {customer.customer_type === "business" ? (
                <Building2 className="h-6 w-6 text-purple-600" />
              ) : (
                <User className="h-6 w-6 text-blue-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                <Badge variant={customer.is_active ? "default" : "secondary"}
                  className={customer.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                  {customer.is_active ? "Actif" : "Inactif"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <span>{customer.code}</span>
                <span>·</span>
                <span>{customer.customer_type === "business" ? "Entreprise" : "Particulier"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openCreditLimitDialog}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configurer la limite de crédit
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteDialog(true);
            }}
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
              <div className={`p-2 rounded-lg ${balance > 0 ? "bg-red-100" : balance < 0 ? "bg-blue-100" : "bg-green-100"}`}>
                <Wallet className={`h-5 w-5 ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-green-600"}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">
                  {balance > 0 ? "Dette du client" : balance < 0 ? "Avance du client" : "Situation"}
                </p>
                <p className={`text-lg font-bold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-green-600"}`}>
                  {balance > 0 ? formatPrice(balance) : balance < 0 ? formatPrice(Math.abs(balance)) : "Aucune dette"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Limite de crédit autorisée</p>
                <p className="text-lg font-bold">
                  {creditLimit > 0 ? formatPrice(creditLimit) : "Non définie"}
                </p>
                {creditLimit > 0 && (
                  <p className="text-xs text-gray-400">
                    Encore {formatPrice(Math.max(0, availableCredit))} disponible
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total des achats</p>
                <p className="text-lg font-bold">{formatPrice(totalPurchases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Ventes récentes</p>
                <p className="text-lg font-bold">{customer.recent_sales?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loyalty Points Card - Always show for debugging, with conditional styling */}
      <Card className={`border-2 ${loyaltyProgram?.is_active ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-400' : 'bg-gray-100 border-gray-300'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${loyaltyProgram?.is_active ? 'bg-amber-100' : 'bg-gray-200'}`}>
                <Star className={`h-6 w-6 ${loyaltyProgram?.is_active ? 'text-amber-600 fill-amber-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                  Points de fidélité {!loyaltyProgram?.is_active && '(Programme inactif)'}
                </p>
                <p className={`text-4xl font-bold ${loyaltyProgram?.is_active ? 'text-amber-800' : 'text-gray-400'}`}>
                  {formatPoints(customerLoyalty?.current_points)} <span className="text-xl font-normal">pts</span>
                </p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className={`text-sm ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                Total gagné: <span className="font-semibold">{formatPoints(customerLoyalty?.total_points_earned)} pts</span>
              </p>
              <p className={`text-sm ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                Total utilisé: <span className="font-semibold">{formatPoints(customerLoyalty?.total_points_redeemed)} pts</span>
              </p>
              {loyaltyProgram?.is_active && loyaltyProgram.min_points_to_redeem > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  Min. pour utiliser: {loyaltyProgram.min_points_to_redeem} pts
                </p>
              )}
            </div>
          </div>

          {/* Échéance à venir : le marchand doit pouvoir prévenir son client
              AVANT que les points ne tombent. */}
          {loyaltyProgram?.is_active &&
            !!customerLoyalty?.next_expiry_at &&
            customerLoyalty.next_expiry_points > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-white/70 p-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">
                    {customerLoyalty.next_expiry_points} points
                  </span>{" "}
                  expirent le {formatDateTime(customerLoyalty.next_expiry_at).split(" ")[0]}
                  {customerLoyalty.points_expiry_days > 0 && (
                    <span className="block text-xs text-amber-600">
                      Validité d&apos;un point : {customerLoyalty.points_expiry_days} jours
                      après son obtention
                    </span>
                  )}
                </p>
              </div>
            )}

          {/* Utiliser les points sur la dette : les points sont convertis en
              montant puis imputés sur les factures ouvertes, de la plus
              ancienne à la plus récente. */}
          {loyaltyProgram?.is_active && availablePoints > 0 && balance > 0 && (
            <div className="mt-4 flex flex-col gap-3 border-t border-amber-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800">
                Utiliser ces points pour réduire la dette du client
                {pointValue > 0 && (
                  <span className="block text-xs text-amber-600">
                    {formatPoints(availablePoints)} pts = {formatPrice(availablePoints * pointValue)} maximum
                  </span>
                )}
              </p>
              <Button
                variant="outline"
                className="border-amber-400 bg-white text-amber-700 hover:bg-amber-50"
                onClick={() => {
                  setDebtPointsUsed(String(maxPointsForDebt));
                  setShowRedeemDebtDialog(true);
                }}
              >
                <Star className="mr-2 h-4 w-4" />
                Payer la dette avec les points
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Details + Transactions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations de contact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customer.customer_type === "business" && customer.company_name && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Raison sociale</p>
                      <p className="font-medium">{customer.company_name}</p>
                    </div>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Téléphone</p>
                      <p className="font-medium">{customer.phone}</p>
                    </div>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{customer.email}</p>
                    </div>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Adresse</p>
                      <p className="font-medium">{customer.address}</p>
                    </div>
                  </div>
                )}
                {customer.customer_type === "business" && customer.tax_id && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">N° Impôt / RCCM</p>
                      <p className="font-medium">{customer.tax_id}</p>
                    </div>
                  </div>
                )}
              </div>

              {customer.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Situation financière</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">Limite de crédit autorisée</p>
                      <button
                        onClick={openCreditLimitDialog}
                        className="text-gray-400 hover:text-orange-500"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="font-semibold">
                      {!customer.allow_credit
                        ? "Crédit refusé"
                        : creditLimit > 0
                          ? formatPrice(creditLimit)
                          : "Sans plafond"}
                    </p>
                    {/* Deux règles distinctes : l'autorisation d'acheter à
                        crédit, et le plafond. Une limite à 0 veut dire « pas de
                        plafond », jamais « pas de crédit ». */}
                    {!customer.allow_credit ? (
                      <p className="text-xs text-red-500 mt-1">
                        Ce client ne peut pas repartir avec une facture impayée
                      </p>
                    ) : creditLimit > 0 ? (
                      <p className="text-xs text-gray-400 mt-1">
                        Le client peut prendre à crédit jusqu&apos;à {formatPrice(creditLimit)} au total
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">
                        Aucun plafond : le crédit accordé n&apos;est pas limité
                      </p>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${balance > 0 ? "bg-red-50" : balance < 0 ? "bg-blue-50" : "bg-green-50"}`}>
                    <p className="text-xs text-gray-500">
                      {balance > 0 ? "Ce client vous doit" : balance < 0 ? "Ce client a une avance de" : "Situation"}
                    </p>
                    <p className={`font-semibold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-green-600"}`}>
                      {balance !== 0 ? formatPrice(Math.abs(balance)) : "Rien à signaler"}
                    </p>
                    {isMultiCurrencyDebt && (
                      <div className="mt-2 space-y-0.5">
                        <p className="text-xs text-gray-500">Détail par devise :</p>
                        {balanceLines.map((line) => (
                          <p key={line.currency} className="text-xs font-medium text-gray-700">
                            {money.money(Math.abs(parseFloat(line.amount)), line.currency)}
                            {parseFloat(line.amount) < 0 && " (avance)"}
                          </p>
                        ))}
                        <p className="text-xs text-gray-400">
                          Le total ci-dessus est converti en {defaultCurrency.code}.
                        </p>
                      </div>
                    )}
                    {creditLimit > 0 && balance > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Peut encore prendre {formatPrice(Math.max(0, availableCredit))} à crédit
                      </p>
                    )}
                    {creditLimit > 0 && balance >= creditLimit && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Limite de crédit atteinte
                      </p>
                    )}
                  </div>
                </div>

              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-400 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Créé le {formatDateTime(customer.created_at)}
                </span>
                {customer.created_by_name && (
                  <span>par {customer.created_by_name}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-orange-500" />
                  Historique des mouvements
                </CardTitle>
                <Select value={txnFilter} onValueChange={setTxnFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les mouvements</SelectItem>
                    <SelectItem value="credit_sale">Achats à crédit</SelectItem>
                    <SelectItem value="payment">Paiements reçus</SelectItem>
                    <SelectItem value="advance">Avances données</SelectItem>
                    <SelectItem value="adjustment">Corrections</SelectItem>
                    <SelectItem value="refund">Remboursements</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTxns ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Aucun mouvement</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Les paiements, avances et achats à crédit apparaîtront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {transactions.map(txn => (
                    <div
                      key={txn.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="p-2 bg-gray-100 rounded-full">
                        {getTxnIcon(txn.transaction_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{txn.transaction_type_display}</p>
                          {txn.sale_reference && (
                            <Link
                              href={`/dashboard/sales/${txn.sale}`}
                              className="text-xs text-orange-600 hover:underline"
                            >
                              {txn.sale_reference}
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formatDateTime(txn.created_at)}</span>
                          {txn.payment_method && (
                            <span>· {txn.payment_method === "cash" ? "Espèces" : txn.payment_method === "mobile_money" ? "Mobile Money" : txn.payment_method === "bank_transfer" ? "Virement" : txn.payment_method === "check" ? "Chèque" : txn.payment_method}</span>
                          )}
                          {txn.reference && <span>· Réf: {txn.reference}</span>}
                        </div>
                        {txn.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{txn.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${getTxnColor(txn.transaction_type)}`}>
                          {getTxnSign(txn.transaction_type)}
                          {money.money(txn.amount, txn.currency || defaultCurrency.code)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Dette après :{" "}
                          {money.money(txn.balance_after, txn.currency || defaultCurrency.code)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historique des points : le registre existait côté backend depuis le
              début mais n'était affiché nulle part. */}
          {loyaltyTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                  Historique des points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {loyaltyTransactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {txn.transaction_type_display}
                          {txn.sale_reference && (
                            <span className="ml-2 text-xs text-gray-400">
                              {txn.sale_reference}
                            </span>
                          )}
                        </p>
                        {txn.description && (
                          <p className="truncate text-xs text-gray-400">{txn.description}</p>
                        )}
                        <p className="text-xs text-gray-400">{formatDateTime(txn.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-semibold ${
                            txn.points >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {txn.points >= 0 ? "+" : ""}
                          {formatPoints(txn.points)} pts
                        </p>
                        <p className="text-xs text-gray-400">Solde : {formatPoints(txn.balance_after)} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Pending Invoices + Recent Sales */}
        <div className="space-y-6">
          {/* Pending Invoices */}
          {pendingSales.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-orange-500" />
                  Factures en attente ({pendingSales.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {pendingSales.map(sale => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
                    >
                      <div>
                        <p className="text-sm font-medium">{sale.reference}</p>
                        {/* Chaque montant dans la devise de SA facture : le
                            symbole de la devise principale affichait une facture
                            de 50 $ en « 50 FC ». */}
                        <p className="text-xs text-gray-500">
                          Total: {money.money(sale.total, sale.currency)} · Reste à payer :{" "}
                          <span className="text-orange-600 font-semibold">
                            {money.money(sale.amount_due, sale.currency)}
                          </span>
                        </p>
                        {sale.due_date && (
                          <p className={`mt-0.5 text-xs ${isOverdue(sale.due_date) ? "font-medium text-red-600" : "text-gray-400"}`}>
                            {dueDateLabel(sale.due_date)} · échéance le {sale.due_date}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openInvoicePaymentDialog(sale)}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1" />
                        Payer
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Sales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-orange-500" />
                Dernières ventes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!customer.recent_sales || customer.recent_sales.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucune vente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customer.recent_sales.map(sale => (
                    <Link
                      key={sale.id}
                      href={`/dashboard/sales/${sale.id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{sale.reference}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(sale.date)}</p>
                      </div>
                      <span className="font-semibold text-sm text-orange-600">
                        {money.money(sale.total, sale.currency || defaultCurrency.code)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Credit Limit Dialog */}
      <Dialog open={showCreditLimitDialog} onOpenChange={setShowCreditLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-500" />
              Conditions de crédit
            </DialogTitle>
            <DialogDescription>
              Deux réglages distincts : l&apos;autorisation d&apos;acheter à crédit,
              et le plafond de dette. Une limite à 0 signifie « sans plafond »,
              pas « crédit refusé ».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <Label htmlFor="allow-credit" className="text-sm font-medium">
                  Autoriser les achats à crédit
                </Label>
                <p className="mt-1 text-xs text-gray-500">
                  Désactivé, ce client doit régler intégralement chaque vente :
                  aucune facture ne peut rester ouverte à son nom.
                </p>
              </div>
              <Switch
                id="allow-credit"
                checked={allowCreditValue}
                onCheckedChange={setAllowCreditValue}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-limit">Montant maximum autorisé à crédit</Label>
              <Input
                id="credit-limit"
                type="number"
                step="any"
                min="0"
                value={creditLimitValue}
                onChange={e => setCreditLimitValue(e.target.value)}
                placeholder="0 = pas de limite"
                disabled={!allowCreditValue}
              />
              <p className="text-xs text-gray-400">
                Mettez 0 pour ne pas plafonner le crédit de ce client.
              </p>
            </div>
            {balance > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                <p className="text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Ce client a actuellement une dette de <span className="font-semibold">{formatPrice(balance)}</span>.
                </p>
                {parseFloat(creditLimitValue) > 0 && parseFloat(creditLimitValue) < balance && (
                  <p className="text-yellow-700 text-xs mt-1">
                    Attention : la nouvelle limite est inférieure à la dette actuelle.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditLimitDialog(false)}>Annuler</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleUpdateCreditLimit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le client</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le client &quot;{customer.name}&quot; ?
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

      {/* Utilisation des points sur la dette globale */}
      <Dialog open={showRedeemDebtDialog} onOpenChange={setShowRedeemDebtDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
              Payer la dette avec les points
            </DialogTitle>
            <DialogDescription>
              Les points sont convertis en montant, puis imputés sur les factures
              ouvertes de la plus ancienne à la plus récente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-wider text-amber-600">Points disponibles</p>
                <p className="text-xl font-bold text-amber-800">{availablePoints}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs uppercase tracking-wider text-red-600">Dette en {defaultCurrency.code}</p>
                <p className="text-xl font-bold text-red-700">{formatPrice(primaryDebt)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Points à utiliser</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={maxPointsForDebt}
                  step="0.01"
                  value={debtPointsUsed}
                  onChange={(e) => setDebtPointsUsed(e.target.value)}
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => setDebtPointsUsed(String(maxPointsForDebt))}
                >
                  Maximum
                </Button>
              </div>
              {debtPointsValue > 0 && (
                <p className="text-sm text-amber-800">
                  Soit {formatPrice(debtPointsValue)} déduits de la dette
                </p>
              )}
              {loyaltyProgram && loyaltyProgram.min_points_to_redeem > 0 && (
                <p className="text-xs text-gray-500">
                  Minimum {loyaltyProgram.min_points_to_redeem} points
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowRedeemDebtDialog(false)}
              className="sm:flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleRedeemPointsToDebt}
              disabled={isSubmitting || (parseFloat(debtPointsUsed) || 0) <= 0}
              className="bg-amber-600 hover:bg-amber-700 sm:flex-1"
            >
              {isSubmitting ? "Traitement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Règlement d'une facture : même grammaire que la modale
          « Encaissement » du POS (en-tête et pied fixes, corps défilant,
          points en popover, moyen de paiement en liste déroulante, bilan du
          règlement sous le montant reçu). */}
      <Dialog
        open={showInvoicePaymentDialog}
        onOpenChange={(open) => {
          if (isSubmitting) {
            // Fermer pendant l'envoi laisse croire que rien n'a été enregistré :
            // le caissier recommence et paie deux fois. Même garde qu'au POS.
            if (!open) {
              toast.info("Traitement en cours, merci de patienter avant de fermer.");
            }
            return;
          }
          if (!open) closeInvoicePaymentDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-500" />
              Payer une facture
            </DialogTitle>
            <DialogDescription className="text-start">
              Facture <span className="font-semibold text-gray-900">{selectedSale?.reference}</span>
              {selectedSale?.sale_date && (
                <> - {formatDateTime(selectedSale.sale_date)}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            if (!selectedSale) return null;

            const saleCur = selectedSale.currency || defaultCurrency.code;
            const payCur = invoicePaymentCurrency || saleCur;
            const dueInSale = parseFloat(selectedSale.amount_due) || 0;
            // Reste à payer une fois les points imputés : c'est ce que le
            // caissier doit encore réunir en argent.
            const dueAfterPoints = Math.max(0, dueInSale - pointsValue);
            const raw = parseFloat(invoicePaymentAmount) || 0;
            const paidInSale = raw > 0 ? invToSaleCurrency(raw) : 0;
            const remaining = dueAfterPoints - paidInSale;
            const method = paymentMethods.find(m => m.id === selectedPaymentMethod);

            return (
              <>
                <div className="space-y-5 overflow-y-auto flex-1 pr-2">

                  {/* 1. Points de fidélité. Placés avant le récapitulatif :
                      ils changent le reste à payer, donc le montant à saisir. */}
                  {canUsePointsOnInvoice && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Points de fidélité ({formatPoints(availablePoints)} pts)
                      </Label>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        {/* La case à cocher EST l'ancre du popover : cocher
                            demande combien, décocher annule sans rien demander. */}
                        <LoyaltyPointsPicker
                          open={showInvoicePointsPicker}
                          onOpenChange={setShowInvoicePointsPicker}
                          balance={availablePoints}
                          minPoints={minPointsToRedeem}
                          maxPoints={maxUsablePoints}
                          pointValue={pointValue}
                          maxAmount={maxRedeemableAmount}
                          formatAmount={formatPrice}
                          initial={enteredPoints}
                          onConfirm={(points) => {
                            // Le montant saisi n'est jamais recalculé : c'est
                            // la saisie du caissier. Si points + argent dépassent
                            // le reste dû, le bilan le dit en rouge et bloque.
                            setInvoicePointsUsed(points > 0 ? String(points) : "");
                          }}
                        >
                          <button
                            type="button"
                            disabled={!pointsRedeemable}
                            aria-pressed={enteredPoints > 0}
                            onClick={(e) => {
                              if (enteredPoints > 0) {
                                // Décocher est une annulation : immédiate, sans
                                // popover. `preventDefault` neutralise le handler
                                // du trigger, que Radix compose après celui-ci.
                                e.preventDefault();
                                setShowInvoicePointsPicker(false);
                                setInvoicePointsUsed("");
                              }
                            }}
                            className={`flex w-full items-center gap-2.5 text-left ${pointsRedeemable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                              }`}
                          >
                            <span
                              aria-hidden
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${enteredPoints > 0
                                ? "border-amber-600 bg-amber-600 text-white"
                                : "border-amber-300 bg-white"
                                }`}
                            >
                              {enteredPoints > 0 && <Check className="h-3 w-3" />}
                            </span>
                            <span className="text-sm font-medium text-amber-800">
                              Régler une partie avec les points
                            </span>
                          </button>
                        </LoyaltyPointsPicker>

                        {!pointsRedeemable && (
                          <p className="mt-2 border-t border-amber-200 pt-2 text-xs text-amber-600">
                            {maxUsablePoints <= 0
                              ? "Cette facture n'est plus réglable en points."
                              : `Il faut au moins ${formatPoints(minPointsToRedeem)} points, ` +
                                `or seuls ${formatPoints(maxUsablePoints)} sont utilisables ici.`}
                          </p>
                        )}

                        {pointsRedeemable && pointsValue > 0 && (
                          <div className="mt-2 flex items-center justify-between border-t border-amber-200 pt-2">
                            <span className="text-xs text-amber-700">
                              {formatPoints(enteredPoints)} pts appliqués ·{" "}
                              <span className="font-semibold">-{formatPrice(pointsValue)}</span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowInvoicePointsPicker(true)}
                              className="h-7 px-2 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                            >
                              Modifier
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. Récapitulatif de la facture (dans SA devise).
                      Les trois colonnes d'origine ne pouvaient pas montrer la
                      déduction des points : le reste à payer baissait sans que
                      rien n'explique l'écart. */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Récapitulatif
                    </Label>
                    <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total facture</span>
                        <span className="font-medium">
                          {money.money(selectedSale.total || 0, saleCur)}
                        </span>
                      </div>
                      {(parseFloat(selectedSale.amount_paid) || 0) > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Déjà payé</span>
                          <span>-{money.money(selectedSale.amount_paid || 0, saleCur)}</span>
                        </div>
                      )}
                      {pointsValue > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Points appliqués ({formatPoints(enteredPoints)} pts)</span>
                          <span>-{money.money(pointsValue, saleCur)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                        <span>Reste à payer</span>
                        <span className="text-orange-600">{money.money(dueAfterPoints, saleCur)}</span>
                      </div>
                      {payCur !== saleCur && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>≈ à encaisser en {payCur}</span>
                          <span>{money.money(money.convMoney(dueAfterPoints, saleCur, payCur), payCur)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Moyen de paiement + montant reçu */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Moyen de paiement
                    </Label>

                    {/* Liste déroulante plutôt que la grille de tuiles : elle
                        prenait un tiers de la modale pour deux ou trois choix. */}
                    <Select
                      value={selectedPaymentMethod}
                      onValueChange={setSelectedPaymentMethod}
                    >
                      <SelectTrigger className="h-11 w-full border-orange-300 bg-orange-50/60 text-orange-800">
                        <SelectValue placeholder="Choisir un moyen de paiement" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="flex items-center gap-2">
                              {methodIcon(m.method_type)}
                              {m.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Montant reçu
                        </Label>
                        {orgCurrencies.length > 1 && (
                          <div className="flex gap-1">
                            {orgCurrencies.map((c) => (
                              <button
                                key={c.currency_code}
                                type="button"
                                onClick={() => changeInvoicePaymentCurrency(c.currency_code)}
                                className={`px-2 py-1 rounded-md border text-xs font-semibold ${payCur === c.currency_code
                                  ? "border-orange-500 bg-orange-50 text-orange-700"
                                  : "border-gray-200 bg-white text-gray-500"
                                  }`}
                              >
                                {c.currency_code}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        {/* Aucun placeholder : un montant en gris dans le champ
                            se lit comme une valeur déjà saisie. Le reste à payer
                            est annoncé juste au-dessus, dans le récapitulatif. */}
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={invoicePaymentAmount}
                          onChange={(e) => setInvoicePaymentAmount(e.target.value)}
                          className="h-11 text-xl text-center font-bold pl-10 pr-16 ring-0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                          {money.symbolOf(payCur)}
                        </span>
                      </div>

                      {payCur !== saleCur && raw > 0 && (
                        <p className="text-xs text-blue-600">
                          = {money.money(paidInSale, saleCur)}
                          {"  "}({money.rateLabel(payCur, saleCur)})
                        </p>
                      )}

                      {/* Référence de transaction : l'état existait et partait
                          bien à l'API, mais aucun champ ne permettait de le
                          saisir. Un règlement Mobile Money arrivait sans numéro. */}
                      {method?.requires_reference && (
                        <Input
                          value={invoicePaymentRef}
                          onChange={(e) => setInvoicePaymentRef(e.target.value)}
                          placeholder="N° transaction, référence..."
                          className="h-9"
                        />
                      )}
                    </div>

                    {/* Bilan du règlement, TOUJOURS dans la devise de la
                        facture : c'est elle qui porte la dette. */}
                    <div className="p-3 bg-gray-50 rounded-xl space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total réglé</span>
                        <span className="font-semibold">
                          {money.money(paidInSale + pointsValue, saleCur)}
                        </span>
                      </div>

                      {remaining > MONEY_EPS && (
                        <div className="flex justify-between pt-2 border-t border-gray-200 text-amber-700 font-medium">
                          <span>Restera à payer</span>
                          <span className="text-lg font-bold">
                            {money.money(remaining, saleCur)}
                          </span>
                        </div>
                      )}

                      {Math.abs(remaining) <= MONEY_EPS && (paidInSale + pointsValue) > 0 && (
                        <div className="flex justify-between pt-2 border-t border-gray-200 text-green-700 font-medium">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4" /> Facture soldée
                          </span>
                          <span>0</span>
                        </div>
                      )}

                      {/* Le trop-perçu était refusé par un toast APRÈS le clic.
                          L'annoncer ici, et bloquer le bouton, évite de faire
                          composer un montant que le serveur rejettera. */}
                      {remaining < -MONEY_EPS && (
                        <div className="flex justify-between pt-2 border-t border-gray-200 text-red-600 font-medium">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" /> Dépasse le reste à payer
                          </span>
                          <span>{money.money(-remaining, saleCur)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 flex-shrink-0 border-t mt-2">
                  <Button
                    variant="outline"
                    onClick={closeInvoicePaymentDialog}
                    disabled={isSubmitting}
                    className="sm:flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleInvoicePayment}
                    // Une facture peut être réglée uniquement en points,
                    // uniquement en argent, ou par un mélange : c'est ce que fait
                    // `handleInvoicePayment`. Le bouton exigeait pourtant un
                    // montant en argent, rendant le règlement 100 % en points
                    // impossible depuis cette page.
                    disabled={
                      isSubmitting ||
                      (raw > 0 && !selectedPaymentMethod) ||
                      !(raw > 0 || enteredPoints > 0) ||
                      remaining < -MONEY_EPS
                    }
                    className="sm:flex-[2] bg-green-600 hover:bg-green-700 gap-2"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Printer className="h-5 w-5" />
                    )}
                    {isSubmitting
                      ? "Traitement..."
                      : raw > 0
                        ? `Encaisser ${money.money(raw, payCur)}`
                        : `Régler ${formatPoints(enteredPoints)} pts`}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
