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
  Building2,
  CreditCard,
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
import { formatPrice, formatDateTime } from "@/lib/format";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  getCustomer,
  deleteCustomer,
  updateCustomer,
  applyLoyaltyToDebt,
  Customer,
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
  getLoyaltyProgram,
  getOrganizationCurrencies,
  CustomerLoyalty,
  LoyaltyProgram,
  OrganizationCurrency,
} from "@/actions/settings.actions";
import { Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { LoyaltyCreditPicker } from "@/components/sales/loyalty-credit-picker";
import { createMoneyHelpers, MONEY_EPS } from "@/lib/currency";
import { isOverdue, dueDateLabel } from "@/lib/due-date";
import { useOrganization } from "@/components/auth/organization-checker";

/**
 * Arrondi d'une saisie de cagnotte au centième, par DÉFAUT.
 *
 * Jamais au-dessus : on ne propose pas au caissier un montant que le solde du
 * client ne couvre pas.
 */
function arrondiCagnotte(value: number): number {
  return Math.floor(value * 100) / 100;
}

export default function CustomerDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const { currency: defaultCurrency } = useCurrency();

  const [isLoading, setIsLoading] = useState(true);
  const { organization } = useOrganization();
  const { chrome, paperWidth } = useReceiptChrome(session?.accessToken, organization);
  const printer = useReceiptPrinter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Transactions

  // Credit limit dialog
  const [showCreditLimitDialog, setShowCreditLimitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creditLimitValue, setCreditLimitValue] = useState("");
  const [allowCreditValue, setAllowCreditValue] = useState(true);

  // Loyalty points
  const [customerLoyalty, setCustomerLoyalty] = useState<CustomerLoyalty | null>(null);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);

  // Invoice payment dialog
  const [showInvoicePaymentDialog, setShowInvoicePaymentDialog] = useState(false);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [invoicePaymentAmount, setInvoicePaymentAmount] = useState("");
  const [invoicePaymentRef, setInvoicePaymentRef] = useState("");
  // Points de fidélité utilisés sur cette facture (cumulables avec l'argent).
  const [invoiceLoyaltyUsed, setInvoiceLoyaltyUsed] = useState("");
  // Ouverture du popover de saisie des points, comme au POS : le panneau
  // déplié coûtait cinq lignes en permanence pour un geste occasionnel.
  const [showInvoiceLoyaltyPicker, setShowInvoiceLoyaltyPicker] = useState(false);
  // Utilisation des points sur la dette globale du client.
  const [showRedeemDebtDialog, setShowRedeemDebtDialog] = useState(false);
  const [debtLoyaltyUsed, setDebtLoyaltyUsed] = useState("");
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
  // La cagnotte est libellée en devise principale : on ne propose donc son
  // emploi que sur une facture dans cette même devise.
  //
  // ⚠ `Number(...)` : le solde arrive en CHAÎNE, comme tout montant. Le lire
  // tel quel ferait concaténer au lieu d'additionner.
  const availableLoyalty = Number(customerLoyalty?.balance ?? 0) || 0;
  const canUseLoyaltyOnInvoice =
    !!loyaltyProgram?.is_active &&
    availableLoyalty > 0 &&
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
  const maxUsableLoyalty = canUseLoyaltyOnInvoice
    ? Math.min(availableLoyalty, arrondiCagnotte(maxRedeemableAmount))
    : 0;
  const loyaltyRedeemable = maxUsableLoyalty > 0;
  const enteredLoyalty = parseFloat(invoiceLoyaltyUsed) || 0;
  // Miroir de `loyaltyDiscount` du noyau : la remise ne dépasse jamais la part
  // autorisée, et il n'y a plus de minimum à opposer.
  const loyaltyValue = Math.min(enteredLoyalty, maxRedeemableAmount);

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
        // L'organisation vient du contexte d'`OrganizationChecker`,
        // qui ne rend ses enfants qu'une fois celle-ci chargée. La
        // redemander ici plaçait un `GET /organizations/` en tête
        // d'attente, avant la première requête utile de la page.
        if (organization) {
          const org = organization;

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

  // Dépendre de l'IDENTIFIANT du client, pas de l'objet : `refreshData()`
  // remplace l'objet `customer` après chaque opération, ce qui re-déclenchait
  // cet effet et doublait les requêtes déjà lancées explicitement par les
  // handlers (quatre appels réseau au lieu de deux).
  const customerLoaded = customer?.id;
  useEffect(() => {
    if (organization && customerLoaded) {
      loadPendingSales();
    }
  }, [organization, customerLoaded, loadPendingSales]);

  // Handle invoice payment
  const handleInvoicePayment = async () => {
    if (!session?.accessToken || !organization || !customer || !selectedSale) return;

    const loyaltyUsed = parseFloat(invoiceLoyaltyUsed) || 0;
    const amount = parseFloat(invoicePaymentAmount) || 0;

    // Une facture peut être réglée uniquement en cagnotte, uniquement en
    // argent, ou par un mélange des deux.
    if (amount <= 0 && loyaltyUsed <= 0) {
      toast.error("Indiquez un montant à encaisser ou une part de cagnotte");
      return;
    }
    if (amount > 0 && !selectedPaymentMethod) {
      toast.error("Sélectionnez un mode de paiement");
      return;
    }
    // Miroir du refus de `resolve_redemption` : sans lui le caissier
    // encaissait, attendait l'impression, et recevait « Cagnotte inutilisable ».
    if (loyaltyUsed > maxUsableLoyalty) {
      toast.error(
        `Au plus ${formatPrice(maxUsableLoyalty)} de cagnotte sur cette facture.`
      );
      return;
    }

    const amountDue = parseFloat(selectedSale.amount_due) || 0;
    // Le restant dû est en devise de la vente : comparer la valeur convertie,
    // déduction faite de ce que les points couvrent déjà.
    const amountInSale = amount > 0 ? invToSaleCurrency(amount) : 0;
    // Même borne que le serveur : au-delà du plafond, la cagnotte ne couvre
    // pas davantage, et compter la valeur brute sous-estimerait l'argent dû.
    const coveredByLoyalty = Math.min(loyaltyUsed, maxRedeemableAmount);
    // Tolérance d'arrondi partagée avec l'affichage, et montant libellé dans la
    // devise de la facture : `formatPrice` seul y collait le symbole de la
    // devise principale, puis le code de la facture était ajouté derrière -
    // une facture de 50 USD s'annonçait « 50 FC USD ».
    if (amountInSale + coveredByLoyalty > amountDue + MONEY_EPS) {
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
          ...(loyaltyUsed > 0 ? { loyalty_amount_used: loyaltyUsed } : {}),
          reference: invoicePaymentRef || undefined,
        }
      );

      if (result.success) {
        const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
        // Repli à 0 : ces montants partent sur le reçu PDF, où un `NaN`
        // s'imprimerait tel quel.
        const previouslyPaid = parseFloat(selectedSale.amount_paid) || 0;
        const remainingBalance = amountDue - amountInSale - coveredByLoyalty;

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
          amountPaid: amountInSale + coveredByLoyalty,
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
          // puiser dans la cagnotte.
          loyalty: {
            show: !!result.data?.loyalty_program_active,
            used: Number(result.data?.loyalty_used ?? 0) || 0,
            balance: Number(result.data?.loyalty_balance ?? 0) || 0,
            // ⚠ LA CAGNOTTE EST EN DEVISE PRINCIPALE, pas en devise de facture.
            currency: defaultCurrency.code,
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

  // Emploie la cagnotte du client pour éponger sa dette. Le backend l'impute
  // sur les factures ouvertes, de la plus ancienne à la plus récente.
  const handleUseLoyaltyOnDebt = async () => {
    if (!session?.accessToken || !organization || !customer) return;

    const montant = parseFloat(debtLoyaltyUsed) || 0;
    if (montant <= 0) {
      toast.error("Indiquez un montant de cagnotte");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await applyLoyaltyToDebt(
        session.accessToken,
        organization.id,
        customer.id,
        { amount: montant }
      );

      if (result.success && result.data) {
        const { loyalty_amount_used, amount, settled_invoices } = result.data;
        toast.success(`${formatPrice(loyalty_amount_used)} de cagnotte employés`, {
          description: settled_invoices.length
            ? `${formatPrice(amount)} imputés sur : ${settled_invoices.join(", ")}`
            : `${formatPrice(amount)} déduits de la dette`,
        });
        setShowRedeemDebtDialog(false);
        setDebtLoyaltyUsed("");

        await refreshData();
        loadPendingSales();
        const loyaltyResult = await getCustomerLoyalty(
          session.accessToken, organization.id, customer.id
        );
        if (loyaltyResult.success && loyaltyResult.data) {
          setCustomerLoyalty(loyaltyResult.data);
        }
      } else {
        toast.error(result.message || "Erreur lors de l'utilisation de la cagnotte");
      }
    } catch (error) {
      console.error("Error applying loyalty credit:", error);
      toast.error("Erreur lors de l'utilisation de la cagnotte");
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
    setInvoiceLoyaltyUsed("");
    setShowInvoiceLoyaltyPicker(false);
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
    setInvoiceLoyaltyUsed("");
    setShowInvoiceLoyaltyPicker(false);
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
  const maxLoyaltyForDebt =
    primaryDebt > 0 ? Math.min(availableLoyalty, arrondiCagnotte(primaryDebt)) : 0;
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
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/contacts/customers/${customerId}/historique`}>
            <Button variant="outline">
              <History className="h-4 w-4 mr-2" />
              Historique
            </Button>
          </Link>
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
                  Cagnotte de fidélité {!loyaltyProgram?.is_active && '(Programme inactif)'}
                </p>
                <p className={`text-4xl font-bold ${loyaltyProgram?.is_active ? 'text-amber-800' : 'text-gray-400'}`}>
                  {formatPrice(availableLoyalty)}
                </p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className={`text-sm ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                Total gagné : <span className="font-semibold">{formatPrice(customerLoyalty?.total_earned ?? 0)}</span>
              </p>
              <p className={`text-sm ${loyaltyProgram?.is_active ? 'text-amber-700' : 'text-gray-500'}`}>
                Total utilisé : <span className="font-semibold">{formatPrice(customerLoyalty?.total_used ?? 0)}</span>
              </p>
              {loyaltyProgram?.is_active && (
                <p className="text-xs text-amber-600 mt-2">
                  {Number(loyaltyProgram.earn_percent)} % de chaque facture réglée
                </p>
              )}
            </div>
          </div>

          {/* Employer la cagnotte sur la dette : le montant est imputé sur les
              factures ouvertes, de la plus ancienne à la plus récente. */}
          {loyaltyProgram?.is_active && availableLoyalty > 0 && balance > 0 && (
            <div className="mt-4 flex flex-col gap-3 border-t border-amber-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-800">
                Employer cette cagnotte pour réduire la dette du client
                <span className="block text-xs text-amber-600">
                  {formatPrice(maxLoyaltyForDebt)} au maximum, dette comprise
                </span>
              </p>
              <Button
                variant="outline"
                className="border-amber-400 bg-white text-amber-700 hover:bg-amber-50"
                onClick={() => {
                  setDebtLoyaltyUsed(String(maxLoyaltyForDebt));
                  setShowRedeemDebtDialog(true);
                }}
              >
                <Star className="mr-2 h-4 w-4" />
                Payer la dette avec la cagnotte
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

          {/* ┌────────────────────────────────────────────────────────────────┐
          │ LES TROIS LECTURES DU PASSÉ VIVENT DANS UNE SOUS-PAGE.        │
          │                                                                │
          │ Le grand livre, le registre de cagnotte et le rapport par      │
          │ période occupaient trois sections sous la fiche, et noyaient   │
          │ ce qu'on vient y chercher devant un client : sa situation et   │
          │ ce qu'il doit. On les consulte rarement, et longuement.        │
          └────────────────────────────────────────────────────────────────┘ */}
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
              <Link
                href={`/dashboard/contacts/customers/${customerId}/historique`}
                className="mt-3 block text-center text-xs text-orange-600 hover:underline"
              >
                Voir tout l&apos;historique
              </Link>
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
              Payer la dette avec la cagnotte
            </DialogTitle>
            <DialogDescription>
              Le montant est imputé sur les factures ouvertes, de la plus
              ancienne à la plus récente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-wider text-amber-600">Cagnotte disponible</p>
                <p className="text-xl font-bold text-amber-800">{formatPrice(availableLoyalty)}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs uppercase tracking-wider text-red-600">Dette en {defaultCurrency.code}</p>
                <p className="text-xl font-bold text-red-700">{formatPrice(primaryDebt)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Montant de cagnotte à employer</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={maxLoyaltyForDebt}
                  step="0.01"
                  value={debtLoyaltyUsed}
                  onChange={(e) => setDebtLoyaltyUsed(e.target.value)}
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => setDebtLoyaltyUsed(String(maxLoyaltyForDebt))}
                >
                  Maximum
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Au plus {formatPrice(maxLoyaltyForDebt)} : la cagnotte ne couvre
                jamais plus que la dette.
              </p>
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
              onClick={handleUseLoyaltyOnDebt}
              disabled={isSubmitting || (parseFloat(debtLoyaltyUsed) || 0) <= 0}
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
            // Reste à payer une fois la cagnotte imputée : c'est ce que le
            // caissier doit encore réunir en argent.
            const dueAfterLoyalty = Math.max(0, dueInSale - loyaltyValue);
            const raw = parseFloat(invoicePaymentAmount) || 0;
            const paidInSale = raw > 0 ? invToSaleCurrency(raw) : 0;
            const remaining = dueAfterLoyalty - paidInSale;
            const method = paymentMethods.find(m => m.id === selectedPaymentMethod);

            return (
              <>
                <div className="space-y-5 overflow-y-auto flex-1 pr-2">

                  {/* 1. Cagnotte de fidélité. Placée avant le récapitulatif :
                      elle change le reste à payer, donc le montant à saisir. */}
                  {canUseLoyaltyOnInvoice && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Cagnotte de fidélité ({formatPrice(availableLoyalty)})
                      </Label>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        {/* La case à cocher EST l'ancre du popover : cocher
                            demande combien, décocher annule sans rien demander. */}
                        <LoyaltyCreditPicker
                          open={showInvoiceLoyaltyPicker}
                          onOpenChange={setShowInvoiceLoyaltyPicker}
                          balance={availableLoyalty}
                          maxAmount={maxUsableLoyalty}
                          formatAmount={formatPrice}
                          initial={enteredLoyalty}
                          onConfirm={(montant) => {
                            // Le montant en argent n'est jamais recalculé : c'est
                            // la saisie du caissier. Si cagnotte + argent dépassent
                            // le reste dû, le bilan le dit en rouge et bloque.
                            setInvoiceLoyaltyUsed(montant > 0 ? String(montant) : "");
                          }}
                        >
                          <button
                            type="button"
                            disabled={!loyaltyRedeemable}
                            aria-pressed={enteredLoyalty > 0}
                            onClick={(e) => {
                              if (enteredLoyalty > 0) {
                                // Décocher est une annulation : immédiate, sans
                                // popover. `preventDefault` neutralise le handler
                                // du trigger, que Radix compose après celui-ci.
                                e.preventDefault();
                                setShowInvoiceLoyaltyPicker(false);
                                setInvoiceLoyaltyUsed("");
                              }
                            }}
                            className={`flex w-full items-center gap-2.5 text-left ${loyaltyRedeemable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                              }`}
                          >
                            <span
                              aria-hidden
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${enteredLoyalty > 0
                                ? "border-amber-600 bg-amber-600 text-white"
                                : "border-amber-300 bg-white"
                                }`}
                            >
                              {enteredLoyalty > 0 && <Check className="h-3 w-3" />}
                            </span>
                            <span className="text-sm font-medium text-amber-800">
                              Régler une partie avec la cagnotte
                            </span>
                          </button>
                        </LoyaltyCreditPicker>

                        {!loyaltyRedeemable && (
                          <p className="mt-2 border-t border-amber-200 pt-2 text-xs text-amber-600">
                            Cette facture n&apos;est plus réglable avec la cagnotte.
                          </p>
                        )}

                        {loyaltyRedeemable && loyaltyValue > 0 && (
                          <div className="mt-2 flex items-center justify-between border-t border-amber-200 pt-2">
                            <span className="text-xs text-amber-700">
                              Cagnotte appliquée ·{" "}
                              <span className="font-semibold">-{formatPrice(loyaltyValue)}</span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowInvoiceLoyaltyPicker(true)}
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
                      déduction de la cagnotte : le reste à payer baissait sans
                      que rien n'explique l'écart. */}
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
                      {loyaltyValue > 0 && (
                        <div className="flex justify-between text-amber-600">
                          <span>Cagnotte appliquée</span>
                          <span>-{money.money(loyaltyValue, saleCur)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                        <span>Reste à payer</span>
                        <span className="text-orange-600">{money.money(dueAfterLoyalty, saleCur)}</span>
                      </div>
                      {payCur !== saleCur && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>≈ à encaisser en {payCur}</span>
                          <span>{money.money(money.convMoney(dueAfterLoyalty, saleCur, payCur), payCur)}</span>
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
                          {money.money(paidInSale + loyaltyValue, saleCur)}
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

                      {Math.abs(remaining) <= MONEY_EPS && (paidInSale + loyaltyValue) > 0 && (
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
                    // montant en argent, rendant le règlement intégral en
                    // cagnotte impossible depuis cette page.
                    disabled={
                      isSubmitting ||
                      (raw > 0 && !selectedPaymentMethod) ||
                      !(raw > 0 || enteredLoyalty > 0) ||
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
                        : `Régler ${formatPrice(enteredLoyalty)} de cagnotte`}
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
