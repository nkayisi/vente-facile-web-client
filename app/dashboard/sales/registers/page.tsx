"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import { useEntrepots } from "@/hooks/use-entrepots";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  Calculator,
  Play,
  Square,
  Settings,
  Pencil,
  Trash2,
  Clock,
  CheckCircle,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import {
  getRegisters,
  getRegisterSessions,
  createRegister,
  updateRegister,
  deleteRegister,
  openSession,
  closeSession,
  Register,
  RegisterSession,
  CreateRegisterData,
} from "@/actions/sales.actions";
import { usePermissions } from "@/components/auth/permissions-provider";
import { getOrganizationCurrencies, type OrganizationCurrency } from "@/actions/settings.actions";
import { createMoneyHelpers } from "@/lib/currency";
import { lireNombre, phraseDeRefus } from "@/lib/stock/nombres";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  buildCashSessionReceipt,
  type CashSessionCurrencyLine,
  type CashSessionReceiptData,
} from "@/lib/receipt";
import { chromeDeLaCaisse } from "@/lib/receipt/chrome";
import { formatMoney } from "@vente-facile/core/receipt";
import { chargeDuJeton } from "@/lib/auth/charge-du-jeton";
import { useReceiptChrome } from "@/hooks/use-receipt-chrome";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";
import { useOrganization } from "@/components/auth/organization-checker";

/**
 * Durée écoulée depuis l'ouverture : « depuis 3 h 20 ».
 *
 * Une heure d'ouverture brute obligerait le gérant à faire la soustraction de
 * tête pour savoir si une caisse traîne ouverte depuis la veille.
 */
function formatOpenSince(openedAt?: string | null): string | null {
  if (!openedAt) return null;
  const opened = new Date(openedAt);
  if (Number.isNaN(opened.getTime())) return null;

  const minutes = Math.max(0, Math.round((Date.now() - opened.getTime()) / 60000));
  if (minutes < 60) return `depuis ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `depuis ${hours} h ${String(rest).padStart(2, "0")}` : `depuis ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  return `depuis ${days} j`;
}

export default function RegistersPage() {
  const { data: session } = useSession();
  // `session.user.id` n'est pas porté par la session NextAuth : l'identifiant
  // du compte se lit dans le jeton d'accès, comme le font les filtres.
  const monId = chargeDuJeton(session?.accessToken)?.user_id;
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManageRegisters = hasPermission("sales.manage_registers");

  // State
  const [isLoading, setIsLoading] = useState(true);
  const { organization } = useOrganization();
  const entrepots = useEntrepots();
  const { currency: defaultCurrency } = useCurrency();

  const { chrome, paperWidth } = useReceiptChrome(session?.accessToken, organization);
  const printer = useReceiptPrinter();
  const [registers, setRegisters] = useState<Register[]>([]);
  // Les selects async pour succursale + entrepôt chargent leur liste à la
  // volée - pas besoin de state local complet.
  const [sessions, setSessions] = useState<RegisterSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOpenSessionDialog, setShowOpenSessionDialog] = useState(false);
  // Le refus d'ouverture s'écrit DANS la boîte : « vous avez déjà une session
  // ouverte sur Caisse 2 » nomme la caisse à fermer, et un toast de quatre
  // secondes ne laisse pas le temps de le lire.
  const [refusOuverture, setRefusOuverture] = useState<string | null>(null);
  // Fonds saisi à l'ouverture, PAR DEVISE. Vide = reprise de la dernière
  // clôture, que le serveur applique (`fonds_herite`) et que la caisse annonce.
  const [fondsSaisis, setFondsSaisis] = useState<Record<string, string>>({});
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(orgCurrencies, defaultCurrency),
    [orgCurrencies, defaultCurrency]
  );
  const [showCloseSessionDialog, setShowCloseSessionDialog] = useState(false);
  const [selectedRegister, setSelectedRegister] = useState<Register | null>(null);
  const [selectedSession, setSelectedSession] = useState<RegisterSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Fermeture de session : comptage manuel optionnel + notes
  const [closeCountedBalance, setCloseCountedBalance] = useState<string>("");
  // Comptage manuel par devise (multi-devise RDC) : { code: montant saisi }.
  const [closeCountedByCurrency, setCloseCountedByCurrency] = useState<Record<string, string>>({});
  const [closeNotes, setCloseNotes] = useState<string>("");

  // Form state - plus de champ "branch" : la succursale est dérivée côté backend
  // à partir de l'entrepôt (ou de la succursale principale).
  const [formData, setFormData] = useState<CreateRegisterData>({
    name: "",
    code: "",
    warehouse: "",
    is_active: true,
    receipt_header: "",
    receipt_footer: "",
  });

  // Fetch data
  useEffect(() => {
    if (!session?.accessToken || !organization?.id) return;
    let annule = false;
    getOrganizationCurrencies(session.accessToken, organization.id).then((r) => {
      if (!annule && r.success && r.data) setOrgCurrencies(r.data);
    });
    return () => {
      annule = true;
    };
  }, [session?.accessToken, organization?.id]);

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

          // Fetch in parallel - la liste des succursales/entrepôts est
          // résolue dynamiquement par les selects async.
          const [registersResult, sessionsResult] = await Promise.all([
            getRegisters(session.accessToken, org.id),
            getRegisterSessions(session.accessToken, org.id, { status: "open" }),
          ]);

          if (registersResult.success && registersResult.data) {
            setRegisters(registersResult.data);
          }
          if (sessionsResult.success && sessionsResult.data) {
            setSessions(sessionsResult.data);
          }
        }
      } catch (error) {
        console.error("Error fetching registers:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session?.accessToken, organization?.id]);

  // Mémo conservé pour la stabilité de la ref du handler warehouse -
  // sinon le composant async perd son cache à chaque render du parent.

  // Handle create/update register
  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;

    if (!selectedRegister && !formData.warehouse) {
      toast.error("Veuillez sélectionner un entrepôt.");
      return;
    }

    setIsSubmitting(true);

    try {
      // On n'envoie PAS de succursale : le backend la dérive de l'entrepôt.
      const dataToSend: CreateRegisterData = {
        name: formData.name,
        code: formData.code,
        warehouse: formData.warehouse,
        is_active: formData.is_active,
        receipt_header: formData.receipt_header,
        receipt_footer: formData.receipt_footer,
      };

      let result;
      if (selectedRegister) {
        result = await updateRegister(
          session.accessToken,
          organization.id,
          selectedRegister.id,
          dataToSend
        );
      } else {
        result = await createRegister(session.accessToken, organization.id, dataToSend);
      }

      if (result.success) {
        toast.success(selectedRegister ? "Caisse mise à jour" : "Caisse créée");

        // Refresh list
        const registersResult = await getRegisters(session.accessToken, organization.id);
        if (registersResult.success && registersResult.data) {
          setRegisters(registersResult.data);
        }

        setShowRegisterDialog(false);
        resetForm();
      } else {
        toast.error(result.message || "Erreur lors de l'opération");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete register
  const handleDeleteRegister = async () => {
    if (!session?.accessToken || !organization?.id || !selectedRegister) return;

    setIsSubmitting(true);

    try {
      const result = await deleteRegister(
        session.accessToken,
        organization.id,
        selectedRegister.id
      );

      if (result.success) {
        toast.success("Caisse supprimée");
        setRegisters(prev => prev.filter(r => r.id !== selectedRegister.id));
        setShowDeleteDialog(false);
        setSelectedRegister(null);
      } else {
        toast.error(result.message || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle open session
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id || !selectedRegister) return;

    // Une saisie illisible ou négative RETIENT l'ouverture : l'ignorer ferait
    // reprendre la dernière clôture à la place du montant voulu, en silence.
    const opening_balances: { currency: string; amount: string }[] = [];
    for (const [currency, saisie] of Object.entries(fondsSaisis)) {
      const lu = lireNombre(saisie);
      if (!lu.ok) {
        setRefusOuverture(`Fonds en ${currency} : ${phraseDeRefus(lu.motif)}`);
        return;
      }
      if (lu.valeur !== null) opening_balances.push({ currency, amount: lu.valeur.toFixed(2) });
    }

    setIsSubmitting(true);
    setRefusOuverture(null);

    try {
      const result = await openSession(session.accessToken, organization.id, {
        register: selectedRegister.id,
        ...(opening_balances.length ? { opening_balances } : {}),
      });

      if (result.success) {
        toast.success("Session ouverte avec succès");

        // Refresh data
        const [registersResult, sessionsResult] = await Promise.all([
          getRegisters(session.accessToken, organization.id),
          getRegisterSessions(session.accessToken, organization.id, { status: "open" }),
        ]);

        if (registersResult.success && registersResult.data) {
          setRegisters(registersResult.data);
        }
        if (sessionsResult.success && sessionsResult.data) {
          setSessions(sessionsResult.data);
        }

        setShowOpenSessionDialog(false);

        // Redirect to POS
        router.push("/dashboard/sales/pos");
      } else {
        setRefusOuverture(result.message || "La session n'a pas pu être ouverte.");
      }
    } catch (error) {
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ L'ATTENDU VIENT DU SERVEUR, PAR DEVISE : C'EST CELUI DE LA CLÔTURE.  │
  // │                                                                      │
  // │ Il était refait ici : fonds + total des ventes, en devise principale.│
  // │ Une vente réglée en francs entrait comme des dollars, la monnaie     │
  // │ rendue et les dépenses n'en sortaient pas : « 2 347,4 $ » attendus   │
  // │ pour un tiroir de 1 760,40 $ et 1 322 501 FC (vu le 2026-11-20).     │
  // └──────────────────────────────────────────────────────────────────────┘
  const closeAttendus = useMemo(() => {
    const m = new Map<string, { opening: number; cashIn: number; cashOut: number; expected: number }>();
    for (const e of selectedSession?.expected_balances ?? []) {
      m.set(e.currency, {
        opening: parseFloat(e.opening) || 0,
        cashIn: parseFloat(e.cash_in) || 0,
        cashOut: parseFloat(e.cash_out) || 0,
        expected: parseFloat(e.expected) || 0,
      });
    }
    return m;
  }, [selectedSession]);

  // Devises présentes dans le tiroir de la session (multi-devise RDC).
  const closeCurrencies = useMemo(
    () => [
      ...new Set([
        ...closeAttendus.keys(),
        ...(selectedSession?.currency_balances || []).map(c => c.currency),
      ]),
    ],
    [selectedSession, closeAttendus],
  );

  const closeExpectedBalance = useMemo(() => {
    if (!selectedSession) return 0;
    const seule = closeCurrencies.length === 1 ? closeAttendus.get(closeCurrencies[0]) : undefined;
    if (seule) return seule.expected;
    // Repli d'un serveur antérieur, qui n'exposait pas l'attendu.
    const opening = parseFloat(selectedSession.opening_balance || "0") || 0;
    const salesCash = parseFloat(selectedSession.sales_total || "0") || 0;
    return opening + salesCash;
  }, [selectedSession, closeAttendus, closeCurrencies]);
  const isMultiCurrencyClose = closeCurrencies.length > 1;

  const closeCountedNum = useMemo(() => {
    const v = parseFloat(closeCountedBalance);
    return Number.isFinite(v) ? v : null;
  }, [closeCountedBalance]);

  const closeDifference = useMemo(() => {
    if (closeCountedNum === null) return 0;
    return closeCountedNum - closeExpectedBalance;
  }, [closeCountedNum, closeExpectedBalance]);

  // Handle close session
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id || !selectedSession) return;

    // Mono-devise : on peut pré-valider l'écart client-side. Multi-devise :
    // l'attendu par devise est calculé au backend, qui exige la note si écart.
    if (!isMultiCurrencyClose && closeCountedNum !== null && Math.abs(closeDifference) > 0.005 && !closeNotes.trim()) {
      toast.error("Une note explicative est obligatoire lorsque le comptage diffère du solde attendu.");
      return;
    }

    // Ouvert sur le geste, avant l'appel réseau : sinon le navigateur bloque.
    const closeJob = printer.begin();
    setIsSubmitting(true);

    try {
      const payload: {
        counted_balance?: string;
        counted_balances?: { currency: string; amount: string }[];
        notes?: string;
      } = {};
      if (isMultiCurrencyClose) {
        const entries = closeCurrencies
          .map(c => ({ currency: c, raw: closeCountedByCurrency[c] }))
          .filter(e => e.raw !== undefined && e.raw !== "" && Number.isFinite(parseFloat(e.raw)))
          .map(e => ({ currency: e.currency, amount: parseFloat(e.raw).toFixed(2) }));
        if (entries.length > 0) payload.counted_balances = entries;
      } else if (closeCountedNum !== null) {
        payload.counted_balance = closeCountedNum.toFixed(2);
      }
      if (closeNotes.trim()) {
        payload.notes = closeNotes.trim();
      }

      const result = await closeSession(
        session.accessToken,
        organization.id,
        selectedSession.id,
        payload,
      );

      if (result.success) {
        // Ticket Z : fermer une caisse ne laissait jusqu'ici aucune trace
        // papier, alors que c'est le moment où le fond est remis et où un écart
        // doit être constaté puis signé.
        const closed = result.data;
        if (chrome && closed) {
          const num = (v: string | null | undefined) => {
            const n = parseFloat(v ?? "0");
            return Number.isFinite(n) ? n : 0;
          };
          const balances: CashSessionCurrencyLine[] = (
            closed.currency_balances?.length
              ? closed.currency_balances
              : [{
                  // Session mono-devise : les soldes plats sont dans la devise
                  // par défaut de l'organisation.
                  currency: defaultCurrency?.code || "CDF",
                  opening_balance: closed.opening_balance,
                  expected_balance: closed.expected_balance,
                  counted_balance: closed.counted_balance,
                  difference: closed.difference,
                }]
          ).map((b) => ({
            currency: b.currency,
            opening: num(b.opening_balance),
            expected: num(b.expected_balance),
            counted: b.counted_balance === null ? null : num(b.counted_balance),
            difference: b.difference === null ? null : num(b.difference),
          }));

          const receipt: CashSessionReceiptData = {
            kind: "cash_session",
            // Le Z porte l'en-tête de la caisse qu'il clôture : cet écran en
            // gère plusieurs, le chrome du hook ne peut pas savoir laquelle.
            chrome: chromeDeLaCaisse(
              chrome,
              registers.find((r) => r.id === selectedSession.register),
            ),
            // La session n'est pas numérotée côté serveur : sa référence est son
            // identifiant, réduit à une forme lisible au comptoir.
            number: `CZ-${closed.id.slice(0, 8).toUpperCase()}`,
            date: new Date().toLocaleString("fr-CD"),
            registerName: closed.register_name,
            // Pas de `cashierName` : les lignes « Ouverte par » et « Fermée par »
            // le disent mieux, et plus précisément.
            warehouseName: closed.warehouse_name || undefined,
            openedAt: new Date(closed.opened_at).toLocaleString("fr-CD"),
            closedAt: closed.closed_at
              ? new Date(closed.closed_at).toLocaleString("fr-CD")
              : new Date().toLocaleString("fr-CD"),
            openedByName: closed.opened_by_name,
            closedByName: closed.closed_by_name || undefined,
            salesCount: closed.sales_count,
            // Le formateur de PAPIER, comme le Z du terminal : « 1 700 000 FC »,
            // jamais un nombre nu, et dans la devise du billet reçu.
            paymentsSummary: (closed.payments_summary ?? []).map((p) => ({
              method: p.method,
              total: p.currency
                ? formatMoney(parseFloat(p.total) || 0, p.currency)
                : p.total,
            })),
            balances,
          };

          closeJob.present(buildCashSessionReceipt(receipt), {
            filename: `cloture-caisse-${closed.register_name}.pdf`,
            paperWidth,
            successMessage: "Session fermée",
          });
        } else {
          closeJob.abort();
          toast.success("Session fermée avec succès");
        }

        // Refresh data
        const [registersResult, sessionsResult] = await Promise.all([
          getRegisters(session.accessToken, organization.id),
          getRegisterSessions(session.accessToken, organization.id, { status: "open" }),
        ]);

        if (registersResult.success && registersResult.data) {
          setRegisters(registersResult.data);
        }
        if (sessionsResult.success && sessionsResult.data) {
          setSessions(sessionsResult.data);
        }

        setShowCloseSessionDialog(false);
        setSelectedSession(null);
        setCloseCountedBalance("");
        setCloseCountedByCurrency({});
        setCloseNotes("");
      } else {
        closeJob.abort();
        toast.error(result.message || "Erreur lors de la fermeture");
      }
    } catch (error) {
      closeJob.abort();
      toast.error("Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      warehouse: "",
      is_active: true,
      receipt_header: "",
      receipt_footer: "",
    });
    setSelectedRegister(null);
  };

  // Edit register
  const handleEditRegister = (register: Register) => {
    setSelectedRegister(register);
    setFormData({
      name: register.name,
      code: register.code,
      warehouse: register.warehouse || "",
      is_active: register.is_active,
      receipt_header: register.receipt_header || "",
      receipt_footer: register.receipt_footer || "",
    });
    setShowRegisterDialog(true);
  };


  // Filter registers
  // Get session for register
  const getRegisterSession = (registerId: string) => {
    return sessions.find(s => s.register === registerId);
  };

  /**
   * Caisses ouvertes d'abord, puis actives, puis le reste.
   *
   * C'est la seule chose que le caissier cherche en arrivant : où est ma
   * session en cours. Un tri alphabétique la noierait au milieu des autres.
   */
  const filteredRegisters = (Array.isArray(registers) ? registers : [])
    .filter(
      r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.code.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const rank = (r: Register) => {
        if (getRegisterSession(r.id) || r.current_session) return 0;
        return r.is_active ? 1 : 2;
      };
      return rank(a) - rank(b) || a.name.localeCompare(b.name, "fr");
    });

  const openSessionsCount = filteredRegisters.filter(
    r => getRegisterSession(r.id) || r.current_session
  ).length;

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
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Caisses</h1>
            {/* Le sous-titre dit l'état du parc plutôt que de répéter le titre :
                « une session ouverte » est l'information qu'on vient chercher. */}
            <p className="text-sm text-gray-500 mt-1">
              {filteredRegisters.length} caisse{filteredRegisters.length > 1 ? "s" : ""}
              {openSessionsCount > 0
                ? ` · ${openSessionsCount} session${openSessionsCount > 1 ? "s" : ""} ouverte${openSessionsCount > 1 ? "s" : ""}`
                : " · aucune session ouverte"}
            </p>
          </div>
        </div>
        {canManageRegisters ? (
          <Button
            onClick={() => {
              resetForm();
              setShowRegisterDialog(true);
            }}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle caisse
          </Button>
        ) : null}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher une caisse..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Registers Grid */}
      {filteredRegisters.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune caisse</h3>
            <p className="text-sm text-gray-500 mb-4">
              {canManageRegisters
                ? "Créez votre première caisse pour commencer à vendre."
                : "Aucune caisse disponible pour votre périmètre. Contactez un responsable pour en créer une."}
            </p>
            {canManageRegisters ? (
              <Button onClick={() => setShowRegisterDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer une caisse
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRegisters.map(register => {
            const activeSession = getRegisterSession(register.id);
            const hasSession = !!activeSession || !!register.current_session;

            const openedBy =
              activeSession?.opened_by_name || register.current_session?.opened_by;
            // ┌────────────────────────────────────────────────────────────┐
            // │ ON NE VEND QUE DANS SA SESSION, TOUS RÔLES (lot E1).       │
            // │ « Continuer » sur la session d'un collègue menait au       │
            // │ comptoir, qui ne la retrouvait pas et renvoyait ici : un   │
            // │ bouton qui ramène d'où l'on vient. La CLÔTURE, elle, reste │
            // │ ouverte à tout membre de l'entrepôt.                       │
            // └────────────────────────────────────────────────────────────┘
            const estLaMienne = !!activeSession && activeSession.opened_by === monId;
            const openSince = formatOpenSince(
              activeSession?.opened_at || register.current_session?.opened_at
            );

            return (
              // `h-full` + colonne : toutes les cartes d'une même rangée ont la
              // hauteur de la plus grande, et les boutons se collent en bas au
              // lieu de laisser un vide sous une carte plus courte.
              <Card
                key={register.id}
                className="flex h-full flex-col gap-0 py-0 transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`shrink-0 rounded-lg p-2 ${hasSession ? "bg-green-100" : "bg-gray-100"}`}>
                        <Calculator className={`h-5 w-5 ${hasSession ? "text-green-600" : "text-gray-600"}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium text-gray-900">{register.name}</h3>
                        <p className="truncate text-xs text-gray-500">
                          {register.code} · {register.branch_name}
                        </p>
                      </div>
                    </div>
                    {canManageRegisters ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditRegister(register)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => {
                            setSelectedRegister(register);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {/* Statut et entrepôt sur une seule ligne : trois rangées
                      libellé/valeur pour trois mots gaspillaient la carte. */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge
                      className={
                        register.is_active
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                      }
                    >
                      {register.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="max-w-full gap-1 font-normal text-gray-600">
                      <Warehouse className="h-3 w-3 shrink-0" />
                      <span className="truncate">{register.warehouse_name ?? "Aucun entrepôt"}</span>
                    </Badge>
                  </div>

                  {/* Même bloc des deux côtés, ouvert ou non : c'est ce qui
                      aligne les cartes et évite le trou dans celle sans
                      session. */}
                  {hasSession ? (
                    <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-green-900">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Session ouverte
                        </span>
                        {openSince && (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <Clock className="h-3 w-3" />
                            {openSince}
                          </span>
                        )}
                      </div>
                      {openedBy && (
                        <p className="mt-1 truncate text-xs text-green-700">Par {openedBy}</p>
                      )}
                      {activeSession && (
                        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-green-200 pt-2">
                          <div>
                            <p className="text-[11px] text-green-700">Ventes</p>
                            <p className="text-sm font-semibold tabular-nums text-green-900">
                              {activeSession.sales_count}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-green-700">Encaissé</p>
                            <p className="text-sm font-semibold tabular-nums text-green-900">
                              {formatPrice(activeSession.sales_total)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed bg-gray-50/60 p-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Square className="h-4 w-4 text-gray-400" />
                        Aucune session ouverte
                      </span>
                      <p className="mt-1 text-xs text-gray-500">
                        {register.is_active
                          ? "Ouvrez une session pour encaisser sur cette caisse."
                          : "Cette caisse est désactivée : réactivez-la pour l'utiliser."}
                      </p>
                    </div>
                  )}

                  {/* `mt-auto` : les actions restent au bas de la carte, quelle
                      que soit la hauteur imposée par la rangée. */}
                  <div className="mt-auto flex gap-2 pt-3">
                    {hasSession ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedSession(activeSession || null);
                            setShowCloseSessionDialog(true);
                          }}
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Fermer
                        </Button>
                        {estLaMienne && (
                          <Button
                            size="sm"
                            className="flex-1 bg-orange-500 hover:bg-orange-600"
                            onClick={() => router.push("/dashboard/sales/pos")}
                          >
                            Continuer
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedRegister(register);
                          setRefusOuverture(null);
                          setFondsSaisis({});
                          setShowOpenSessionDialog(true);
                        }}
                        disabled={!register.is_active}
                        title={
                          !register.is_active
                            ? "Cette caisse est désactivée - réactivez-la dans les paramètres pour ouvrir une session."
                            : undefined
                        }
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Ouvrir une session
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Register Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedRegister ? "Modifier la caisse" : "Nouvelle caisse"}
            </DialogTitle>
            <DialogDescription>
              {selectedRegister
                ? "Modifiez les informations de la caisse"
                : "Créez une nouvelle caisse pour votre point de vente"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Caisse 1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  placeholder="CAI001"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Entrepôt *</Label>
              <SearchableSelectAsyncWithEmpty
                value={formData.warehouse || null}
                onValueChange={value => setFormData({ ...formData, warehouse: value || "" })}
                onSearch={entrepots.chercher.action}
                // L'entrepôt ACTUEL d'une caisse s'affiche même s'il n'est plus
                // proposé (désactivé, ou hors de vos entrepôts) : un champ vide
                // ferait croire que la caisse n'en a pas.
                initialOption={
                  selectedRegister?.warehouse
                    ? { value: selectedRegister.warehouse, label: selectedRegister.warehouse_name || "Entrepôt actuel" }
                    : null
                }
                emptyLabel="-"
                placeholder="Sélectionner un entrepôt"
                searchPlaceholder="Rechercher un entrepôt..."
                disabled={!session?.accessToken || !organization?.id}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Caisse active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowRegisterDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedRegister ? "Mettre à jour" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la caisse</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la caisse "{selectedRegister?.name}" ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteRegister} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Session Dialog */}
      <Dialog open={showOpenSessionDialog} onOpenChange={setShowOpenSessionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ouvrir une session</DialogTitle>
            <DialogDescription>
              Ouvrez une session de caisse sur "{selectedRegister?.name}"
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOpenSession} className="space-y-4">
            {(() => {
              // ┌──────────────────────────────────────────────────────────┐
              // │ LE FONDS ANNONCÉ EST CELUI QUE L'OUVERTURE APPLIQUERA.   │
              // │ Ce texte disait « solde d'ouverture à zéro » pendant que │
              // │ le serveur reprenait 1 772,40 $ de la dernière clôture : │
              // │ le caissier comptait son tiroir contre un chiffre faux.  │
              // └──────────────────────────────────────────────────────────┘
              const herite = new Map(
                (selectedRegister?.inherited_opening_balances ?? []).map((l) => [
                  l.currency,
                  parseFloat(String(l.amount)) || 0,
                ])
              );
              const principale = defaultCurrency?.code || "CDF";
              const devises = [
                ...new Set([
                  principale,
                  ...herite.keys(),
                  ...orgCurrencies.filter((c) => c.is_active).map((c) => c.currency_code),
                ]),
              ];
              return (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Fonds de caisse</Label>
                    <p className="text-xs text-gray-500">
                      Laissez vide pour reprendre ce qui a été compté à la dernière clôture.
                    </p>
                  </div>
                  {devises.map((code) => {
                    const saisie = fondsSaisis[code] ?? "";
                    const lu = lireNombre(saisie);
                    const repris = herite.get(code);
                    return (
                      <div key={code} className="grid grid-cols-[3.5rem_1fr] items-start gap-2">
                        <span className="pt-2 text-sm font-semibold text-gray-700">{code}</span>
                        <div className="space-y-1">
                          <Input
                            inputMode="decimal"
                            aria-label={`Fonds de caisse en ${code}`}
                            value={saisie}
                            placeholder={money.money(repris ?? 0, code)}
                            onChange={(e) =>
                              setFondsSaisis((prev) => ({ ...prev, [code]: e.target.value }))
                            }
                            aria-invalid={!lu.ok}
                          />
                          {!lu.ok ? (
                            <p className="text-xs text-destructive">{phraseDeRefus(lu.motif)}</p>
                          ) : (
                            <p className="text-xs text-gray-500">
                              {saisie.trim() !== ""
                                ? "Ce montant remplace la reprise."
                                : repris !== undefined
                                  ? `Repris de la dernière clôture : ${money.money(repris, code)}`
                                  : "Aucune clôture précédente : le tiroir part de zéro."}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-sm text-gray-600">
                    Vous serez redirigé vers le point de vente. Une seule session ouverte par
                    personne : on ne vend que dans la sienne.
                  </p>
                </div>
              );
            })()}
            {refusOuverture && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {refusOuverture}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOpenSessionDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ouvrir la session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog
        open={showCloseSessionDialog}
        onOpenChange={(open) => {
          setShowCloseSessionDialog(open);
          if (!open) {
            setCloseCountedBalance("");
        setCloseCountedByCurrency({});
            setCloseNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fermer la session</DialogTitle>
            <DialogDescription>
              Vérifiez le comptage de caisse avant de clôturer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCloseSession} className="space-y-4">
            {selectedSession && (
              <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ventes</span>
                  <span className="font-medium">
                    {selectedSession.sales_count} ({formatPrice(selectedSession.sales_total)})
                  </span>
                </div>
                {closeAttendus.size > 0 ? (
                  // Une ligne par devise : on compte des liasses distinctes.
                  [...closeAttendus.entries()].map(([code, a]) => (
                    <div key={code} className="space-y-0.5 border-t pt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">Attendu en {code}</span>
                        <span className="font-semibold">{money.money(a.expected, code)}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Fonds {money.money(a.opening, code)} · espèces reçues{" "}
                        {money.money(a.cashIn, code)} · sorties {money.money(a.cashOut, code)}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600 font-medium">Solde attendu</span>
                    <span className="font-semibold">
                      {formatPrice(closeExpectedBalance.toFixed(2))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {isMultiCurrencyClose ? (
              <div className="space-y-2">
                <Label>Montant réellement compté, par devise (optionnel)</Label>
                <p className="text-xs text-gray-500">
                  Le tiroir contient plusieurs devises : comptez chacune séparément.
                  Une devise laissée vide est clôturée à son attendu.
                </p>
                {closeCurrencies.map((code) => {
                  const attendu = closeAttendus.get(code)?.expected;
                  const saisie = closeCountedByCurrency[code] ?? "";
                  const compte = saisie === "" ? null : parseFloat(saisie);
                  const ecart =
                    attendu !== undefined && compte !== null && Number.isFinite(compte)
                      ? compte - attendu
                      : null;
                  return (
                    <div key={code} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-sm font-semibold">{code}</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          aria-label={`Montant compté en ${code}`}
                          placeholder={
                            attendu !== undefined
                              ? `Attendu : ${money.money(attendu, code)}`
                              : "Laisser vide pour utiliser l'attendu"
                          }
                          value={saisie}
                          onChange={(e) =>
                            setCloseCountedByCurrency((prev) => ({ ...prev, [code]: e.target.value }))
                          }
                        />
                      </div>
                      {ecart !== null && Math.abs(ecart) > 0.005 && (
                        <p
                          className={`pl-16 text-xs font-medium ${
                            ecart < 0 ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          Écart : {ecart > 0 ? "+" : ""}
                          {money.money(ecart, code)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="counted_balance">
                  Montant réellement compté en caisse (optionnel)
                </Label>
                <Input
                  id="counted_balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Laisser vide pour utiliser le solde attendu"
                  value={closeCountedBalance}
                  onChange={(e) => setCloseCountedBalance(e.target.value)}
                />
                {closeCountedNum !== null && Math.abs(closeDifference) > 0.005 && (
                  <p
                    className={
                      closeDifference < 0
                        ? "text-sm font-medium text-red-600"
                        : "text-sm font-medium text-amber-600"
                    }
                  >
                    Écart : {closeDifference > 0 ? "+" : ""}
                    {formatPrice(closeDifference.toFixed(2))}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="close_notes">
                Notes {closeCountedNum !== null && Math.abs(closeDifference) > 0.005 && (
                  <span className="text-red-600">*</span>
                )}
              </Label>
              <textarea
                id="close_notes"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Explication obligatoire en cas d'écart"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCloseSessionDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Fermer la session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
