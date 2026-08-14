"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Printer,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  getUserOrganizations,
  Organization,
} from "@/actions/organization.actions";
import {
  getOrganizationCurrencies,
  OrganizationCurrency,
} from "@/actions/settings.actions";
import {
  getDailyReport,
  getMonthlyReport,
  getAnnualReport,
  getCustomReport,
  DailyReport,
  MonthlyReport,
  AnnualReport,
  CustomReport,
  CurrencyReportRow,
} from "@/actions/cashbook.actions";
import {
  createPDFDocument,
  addSummarySection,
  addTable,
  addSignatureSection,
  formatNumberForPDF,
  formatDateForPDF,
  formatMonthForPDF,
} from "@/lib/pdf-utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DataPagination } from "@/components/shared/DataPagination";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Vente",
  sale_return: "Remboursement client",
  expense: "Dépense",
  purchase: "Achat fournisseur",
  supplier_refund: "Remboursement fournisseur",
  debt_collection: "Recouvrement dette",
  fund_in: "Apport de fonds",
  fund_out: "Retrait de fonds",
  adjustment: "Ajustement",
  other_in: "Autre entrée",
  other_out: "Autre sortie",
};

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function CashbookReportsPage() {
  const { data: session } = useSession();
  const { currency: defaultCurrency } = useCurrency();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Formatage par devise (CDF = 0 déc., USD/EUR = 2). Jamais de mélange.
  const decimalsOf = (code: string) => {
    const c = orgCurrencies.find((x) => x.currency_code === code);
    return c ? c.currency_decimal_places : (defaultCurrency.decimal_places ?? 2);
  };
  const symbolOf = (code: string) =>
    orgCurrencies.find((x) => x.currency_code === code)?.currency_symbol ||
    (code === defaultCurrency.code ? defaultCurrency.symbol : code);
  const money = (amount: string | number, code: string) => {
    const n = typeof amount === "string" ? parseFloat(amount) : amount;
    const value = isNaN(n) ? 0 : n;
    return `${new Intl.NumberFormat("fr-CD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalsOf(code),
    }).format(value)} ${symbolOf(code)}`;
  };

  // Montant SANS symbole (le code de devise sert de label → pas de doublon).
  const amountOnly = (amount: string | number, code: string) => {
    const n = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("fr-CD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalsOf(code),
    }).format(isNaN(n) ? 0 : n);
  };

  // Signe affiché uniquement si le montant est non nul (évite « -0 » / « +0 »).
  const sgn = (amount: string | number, sign: string) =>
    (parseFloat(String(amount)) || 0) !== 0 ? sign : "";

  // Une carte-métrique (Ouverture/Entrées/…) listant une ligne « CODE : montant »
  // par devise, sans jamais additionner ni répéter la devise.
  const renderReportMetricCard = (
    title: string,
    icon: ReactNode,
    iconBg: string,
    rows: CurrencyReportRow[] | undefined,
    pick: (r: CurrencyReportRow) => string,
    opts?: { sign?: string; className?: string; colorBySign?: boolean },
  ) => (
    <Card className="gap-0">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
      </CardHeader>
      <CardContent className="pt-0">
        {!rows || rows.length === 0 ? (
          <div className="text-lg font-bold">{amountOnly(0, defaultCurrency.code)} {defaultCurrency.code}</div>
        ) : (
          <div className="space-y-1">
            {rows.map((r) => {
              const val = pick(r);
              const cls = opts?.colorBySign
                ? parseFloat(val) >= 0 ? "text-green-600" : "text-red-600"
                : opts?.className ?? "";
              return (
                <div key={r.currency} className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-gray-400">{r.currency}</span>
                  <span className={`text-lg font-bold ${cls}`}>{sgn(val, opts?.sign ?? "")}{amountOnly(val, r.currency)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // 4 cartes-métriques par devise : Ouverture, Entrées, Sorties, Clôture.
  const renderReportSummaryCards = (rows?: CurrencyReportRow[]) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {renderReportMetricCard(
        "Solde d'ouverture",
        <Wallet className="h-5 w-5 text-gray-600" />, "bg-gray-100",
        rows, (r) => r.opening_balance,
      )}
      {renderReportMetricCard(
        "Total entrées",
        <TrendingUp className="h-5 w-5 text-green-600" />, "bg-green-100",
        rows, (r) => r.total_in, { sign: "+", className: "text-green-600" },
      )}
      {renderReportMetricCard(
        "Total sorties",
        <TrendingDown className="h-5 w-5 text-red-600" />, "bg-red-100",
        rows, (r) => r.total_out, { sign: "-", className: "text-red-600" },
      )}
      {renderReportMetricCard(
        "Solde de clôture",
        <ArrowRightLeft className="h-5 w-5 text-blue-600" />, "bg-blue-100",
        rows, (r) => r.closing_balance, { className: "text-blue-600" },
      )}
    </div>
  );

  // Daily report
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyMovementsPage, setDailyMovementsPage] = useState(1);

  // Monthly report
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);

  // Annual report
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear());
  const [annualReport, setAnnualReport] = useState<AnnualReport | null>(null);

  // Custom report
  const [customDateFrom, setCustomDateFrom] = useState(
    new Date(new Date().setDate(1)).toISOString().split("T")[0]
  );
  const [customDateTo, setCustomDateTo] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [customReport, setCustomReport] = useState<CustomReport | null>(null);

  const [activeTab, setActiveTab] = useState("daily");

  useEffect(() => {
    async function fetchOrganization() {
      if (session?.accessToken) {
        const result = await getUserOrganizations(session.accessToken);
        if (result.success && result.data && result.data.length > 0) {
          const org = result.data[0];
          setOrganization(org);
          const ccyRes = await getOrganizationCurrencies(session.accessToken, org.id);
          if (ccyRes.success && ccyRes.data) {
            setOrgCurrencies(Array.isArray(ccyRes.data) ? ccyRes.data : []);
          }
        }
      }
    }
    fetchOrganization();
  }, [session?.accessToken]);

  useEffect(() => {
    if (organization && session?.accessToken) {
      if (activeTab === "daily") fetchDailyReport();
      else if (activeTab === "monthly") fetchMonthlyReport();
      else if (activeTab === "annual") fetchAnnualReport();
      else if (activeTab === "custom") fetchCustomReport();
    }
  }, [organization, session?.accessToken, activeTab, selectedDate, selectedYear, selectedMonth, annualYear, customDateFrom, customDateTo, dailyMovementsPage]);

  async function fetchDailyReport() {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const res = await getDailyReport(session.accessToken, organization.id, selectedDate, dailyMovementsPage);
      if (res.success && res.data) setDailyReport(res.data);
    } catch {
      toast.error("Erreur lors du chargement du rapport");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchMonthlyReport() {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const res = await getMonthlyReport(session.accessToken, organization.id, selectedYear, selectedMonth);
      if (res.success && res.data) setMonthlyReport(res.data);
    } catch {
      toast.error("Erreur lors du chargement du rapport");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAnnualReport() {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const res = await getAnnualReport(session.accessToken, organization.id, annualYear);
      if (res.success && res.data) setAnnualReport(res.data);
    } catch {
      toast.error("Erreur lors du chargement du rapport annuel");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCustomReport() {
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const res = await getCustomReport(session.accessToken, organization.id, customDateFrom, customDateTo);
      if (res.success && res.data) setCustomReport(res.data);
    } catch {
      toast.error("Erreur lors du chargement du rapport personnalisé");
    } finally {
      setIsLoading(false);
    }
  }

  function navigateDay(offset: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split("T")[0]);
  }

  function navigateMonth(offset: number) {
    let m = selectedMonth + offset;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(m);
    setSelectedYear(y);
  }

  function formatDayShort(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-CD", {
      day: "2-digit",
      month: "short",
    });
  }

  function formatMonthShort(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-CD", {
      month: "short",
      year: "numeric",
    });
  }

  // Montant PDF-safe AVEC symbole (jsPDF ne rend pas l'espace fine insécable
  // d'Intl → formatNumberForPDF le remplace par un espace normal).
  const pdfMoney = (amount: string | number, code: string) =>
    `${formatNumberForPDF(amount, decimalsOf(code))} ${symbolOf(code)}`;

  // Rend le rapport PDF PAR DEVISE, dans le style classique : pour chaque devise,
  // un titre (si plusieurs devises) + une synthèse horizontale (Ouverture /
  // Entrées / Sorties / Clôture) + un tableau de détail. Aucune somme mélangée.
  // `detailFor(code, opening)` renvoie l'en-tête et le corps du tableau détail.
  const renderCurrencySections = (
    doc: Parameters<typeof addSummarySection>[0],
    startY: number,
    pageWidth: number,
    rows: CurrencyReportRow[] | undefined,
    detailFor: (code: string, opening: number) => { head: string[][]; body: string[][] },
    tableOpts: Parameters<typeof addTable>[4],
  ): number => {
    const list = rows && rows.length > 0 ? rows : [];
    const multi = list.length > 1;
    let y = startY;
    if (list.length === 0) {
      return addSummarySection(doc, y, pageWidth, [
        { label: "Solde ouverture", value: pdfMoney(0, defaultCurrency.code) },
      ]);
    }
    list.forEach((r) => {
      if (multi) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`Devise : ${r.currency}`, 14, y);
        y += 6;
      }
      y = addSummarySection(doc, y, pageWidth, [
        { label: "Solde ouverture", value: pdfMoney(r.opening_balance, r.currency) },
        { label: "Total entrées", value: `${sgn(r.total_in, "+")}${pdfMoney(r.total_in, r.currency)}`, color: "green" },
        { label: "Total sorties", value: `${sgn(r.total_out, "-")}${pdfMoney(r.total_out, r.currency)}`, color: "red" },
        { label: "Solde clôture", value: pdfMoney(r.closing_balance, r.currency), color: "blue" },
      ]);
      const { head, body } = detailFor(r.currency, parseFloat(r.opening_balance));
      y = addTable(doc, y, head, body, tableOpts);
      y += 4;
    });
    return y;
  };

  function printDailyReport() {
    if (!dailyReport || !organization) return;

    const { doc, y: startY, pageWidth } = createPDFDocument({
      title: "RAPPORT JOURNALIER DE CAISSE",
      subtitle: `Date: ${formatDateForPDF(selectedDate)}`,
      organizationName: organization.name,
    });

    const y = renderCurrencySections(
      doc, startY, pageWidth, dailyReport.by_currency,
      (code, opening) => {
        let running = opening;
        const body = dailyReport.movements.results
          .filter((m) => m.currency === code)
          .map((m) => {
            running += (m.direction === "in" ? 1 : -1) * parseFloat(m.amount);
            return [
              new Date(m.movement_date).toLocaleTimeString("fr-CD", { hour: "2-digit", minute: "2-digit" }),
              MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type,
              m.description.substring(0, 30),
              m.direction === "in" ? `+${pdfMoney(m.amount, code)}` : "",
              m.direction === "out" ? `-${pdfMoney(m.amount, code)}` : "",
              pdfMoney(running, code),
            ];
          });
        return { head: [["Heure", "Type", "Description", "Entrée", "Sortie", "Solde cumul"]], body };
      },
      {
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
        highlightColumn: 5,
      },
    );

    addSignatureSection(doc, y, pageWidth, ["Caissier", "Responsable"]);
    doc.save(`rapport-journalier-${selectedDate}.pdf`);
  }

  function printMonthlyReport() {
    if (!monthlyReport || !organization) return;

    const { doc, y: startY, pageWidth } = createPDFDocument({
      title: "RAPPORT MENSUEL DE CAISSE",
      subtitle: `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
      organizationName: organization.name,
    });

    const y = renderCurrencySections(
      doc, startY, pageWidth, monthlyReport.by_currency,
      (code, opening) => {
        let running = opening;
        const body = monthlyReport.by_day
          .filter((day) => day.currency === code)
          .map((day) => {
            running += parseFloat(day.total_in) - parseFloat(day.total_out);
            return [
              formatDateForPDF(day.day),
              `${sgn(day.total_in, "+")}${pdfMoney(day.total_in, code)}`,
              `${sgn(day.total_out, "-")}${pdfMoney(day.total_out, code)}`,
              pdfMoney(running, code),
            ];
          });
        return { head: [["Date", "Entrées", "Sorties", "Solde cumul"]], body };
      },
      {
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
        highlightColumn: 3,
      },
    );

    addSignatureSection(doc, y, pageWidth, ["Caissier", "Responsable"]);
    doc.save(`rapport-mensuel-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.pdf`);
  }

  function printAnnualReport() {
    if (!annualReport || !organization) return;

    const { doc, y: startY, pageWidth } = createPDFDocument({
      title: "RAPPORT ANNUEL DE CAISSE",
      subtitle: `Année ${annualYear}`,
      organizationName: organization.name,
    });

    const y = renderCurrencySections(
      doc, startY, pageWidth, annualReport.by_currency,
      (code, opening) => {
        let running = opening;
        const body = annualReport.by_month
          .filter((m) => m.currency === code)
          .map((m) => {
            running += parseFloat(m.total_in) - parseFloat(m.total_out);
            return [
              formatMonthForPDF(m.month),
              `${sgn(m.total_in, "+")}${pdfMoney(m.total_in, code)}`,
              `${sgn(m.total_out, "-")}${pdfMoney(m.total_out, code)}`,
              pdfMoney(running, code),
            ];
          });
        return { head: [["Mois", "Entrées", "Sorties", "Solde cumul"]], body };
      },
      {
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
        highlightColumn: 3,
      },
    );

    addSignatureSection(doc, y, pageWidth, ["Caissier", "Responsable"]);
    doc.save(`rapport-annuel-${annualYear}.pdf`);
  }

  function printCustomReport() {
    if (!customReport || !organization) return;

    const { doc, y: startY, pageWidth } = createPDFDocument({
      title: "RAPPORT DE CAISSE PERSONNALISÉ",
      subtitle: `Du ${formatDateForPDF(customDateFrom)} au ${formatDateForPDF(customDateTo)}`,
      organizationName: organization.name,
    });

    const y = renderCurrencySections(
      doc, startY, pageWidth, customReport.by_currency,
      (code, opening) => {
        let running = opening;
        const body = customReport.by_day
          .filter((day) => day.currency === code)
          .map((day) => {
            running += parseFloat(day.total_in) - parseFloat(day.total_out);
            return [
              formatDateForPDF(day.day),
              `${sgn(day.total_in, "+")}${pdfMoney(day.total_in, code)}`,
              `${sgn(day.total_out, "-")}${pdfMoney(day.total_out, code)}`,
              pdfMoney(running, code),
            ];
          });
        return { head: [["Date", "Entrées", "Sorties", "Solde cumul"]], body };
      },
      {
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
        highlightColumn: 3,
      },
    );

    addSignatureSection(doc, y, pageWidth, ["Caissier", "Responsable"]);
    doc.save(`rapport-personnalise-${customDateFrom}-${customDateTo}.pdf`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/cashbook">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Rapports de caisse
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Rapports journaliers et mensuels des entrées/sorties
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="daily">
            <Calendar className="h-4 w-4 mr-2" />
            Journalier
          </TabsTrigger>
          <TabsTrigger value="monthly">
            <CalendarDays className="h-4 w-4 mr-2" />
            Mensuel
          </TabsTrigger>
          <TabsTrigger value="annual">
            <CalendarRange className="h-4 w-4 mr-2" />
            Annuel
          </TabsTrigger>
          <TabsTrigger value="custom">
            <CalendarClock className="h-4 w-4 mr-2" />
            Personnalisé
          </TabsTrigger>
        </TabsList>

        {/* ============ DAILY REPORT ============ */}
        <TabsContent value="daily" className="space-y-4 mt-6 sm:mt-0">
          {/* Date Navigation */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="icon" onClick={() => navigateDay(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 sm:w-[180px]"
              />
              <Button variant="outline" size="icon" onClick={() => navigateDay(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {dailyReport && (
              <Button onClick={printDailyReport} variant="outline" className="w-full sm:max-w-max">
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : dailyReport ? (
            <>
              {/* Synthèse par devise */}
              {renderReportSummaryCards(dailyReport.by_currency)}

              {/* By Type */}
              {dailyReport.by_type.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Résumé par type</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Devise</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead className="text-right">Nombre</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyReport.by_type.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              {MOVEMENT_TYPE_LABELS[item.movement_type] || item.movement_type}
                            </TableCell>
                            <TableCell className="font-medium text-gray-600">{item.currency}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  item.direction === "in"
                                    ? "bg-green-100 text-green-700 hover:bg-green-100"
                                    : "bg-red-100 text-red-700 hover:bg-red-100"
                                }
                              >
                                {item.direction === "in" ? "Entrée" : "Sortie"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{item.count}</TableCell>
                            <TableCell
                              className={`text-right font-semibold ${item.direction === "in" ? "text-green-600" : "text-red-600"
                                }`}
                            >
                              {item.direction === "in" ? "+" : "-"}
                              {amountOnly(item.total, item.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Movements List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Détail des mouvements ({dailyReport.movements.count})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Heure</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-right">Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReport.movements.results.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            Aucun mouvement ce jour
                          </TableCell>
                        </TableRow>
                      ) : (
                        dailyReport.movements.results.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm text-gray-600">
                              {new Date(m.movement_date).toLocaleTimeString("fr-CD", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {m.reference}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  m.direction === "in"
                                    ? "bg-green-100 text-green-700 hover:bg-green-100"
                                    : "bg-red-100 text-red-700 hover:bg-red-100"
                                }
                              >
                                {MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type_display}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate text-sm">
                              {m.description}
                            </TableCell>
                            <TableCell
                              className={`text-right font-semibold ${m.direction === "in" ? "text-green-600" : "text-red-600"
                                }`}
                            >
                              {m.direction === "in" ? "+" : "-"}
                              {money(m.amount, m.currency)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-600">
                              {money(m.balance_after, m.currency)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {dailyReport.movements.total_pages > 1 && (
                    <div className="p-4 border-t">
                      <DataPagination
                        currentPage={dailyReport.movements.page}
                        totalPages={dailyReport.movements.total_pages}
                        onPageChange={setDailyMovementsPage}
                        hasNext={dailyReport.movements.page < dailyReport.movements.total_pages}
                        hasPrevious={dailyReport.movements.page > 1}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ============ MONTHLY REPORT ============ */}
        <TabsContent value="monthly" className="space-y-4 mt-6 sm:mt-0">
          {/* Month Navigation */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-base sm:text-lg font-semibold flex-1 sm:min-w-[200px] text-center">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {monthlyReport && (
              <Button onClick={printMonthlyReport} variant="outline" className="w-full sm:max-w-max">
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : monthlyReport ? (
            <>
              {/* Synthèse par devise */}
              {renderReportSummaryCards(monthlyReport.by_currency)}

              {/* Daily Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Détail par jour</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead className="text-right">Entrées</TableHead>
                        <TableHead className="text-right">Sorties</TableHead>
                        <TableHead className="text-right">Solde cumul</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Solde cumulé PAR DEVISE (jamais mélangé), amorcé sur
                        // l'ouverture de chaque devise.
                        const running: Record<string, number> = {};
                        (monthlyReport.by_currency || []).forEach((r) => {
                          running[r.currency] = parseFloat(r.opening_balance);
                        });
                        return monthlyReport.by_day.map((day, i) => {
                          const cur = day.currency;
                          if (running[cur] === undefined) running[cur] = 0;
                          running[cur] += parseFloat(day.total_in) - parseFloat(day.total_out);
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{formatDayShort(day.day)}</TableCell>
                              <TableCell className="text-gray-600">{cur}</TableCell>
                              <TableCell className="text-right text-green-600">{sgn(day.total_in, "+")}{amountOnly(day.total_in, cur)}</TableCell>
                              <TableCell className="text-right text-red-600">{sgn(day.total_out, "-")}{amountOnly(day.total_out, cur)}</TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                {amountOnly(running[cur], cur)}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      {monthlyReport.by_day.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            Aucun mouvement ce mois
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ============ ANNUAL REPORT ============ */}
        <TabsContent value="annual" className="space-y-4 mt-6 sm:mt-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="icon" onClick={() => setAnnualYear(annualYear - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-base sm:text-lg font-semibold flex-1 sm:min-w-[100px] text-center">
                {annualYear}
              </div>
              <Button variant="outline" size="icon" onClick={() => setAnnualYear(annualYear + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {annualReport && (
              <Button onClick={printAnnualReport} variant="outline" className="w-full sm:max-w-max">
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : annualReport ? (
            <>
              {/* Synthèse par devise */}
              {renderReportSummaryCards(annualReport.by_currency)}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Détail par mois</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mois</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead className="text-right">Entrées</TableHead>
                        <TableHead className="text-right">Sorties</TableHead>
                        <TableHead className="text-right">Solde cumul</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const running: Record<string, number> = {};
                        (annualReport.by_currency || []).forEach((r) => {
                          running[r.currency] = parseFloat(r.opening_balance);
                        });
                        return annualReport.by_month.map((m, i) => {
                          const cur = m.currency;
                          if (running[cur] === undefined) running[cur] = 0;
                          running[cur] += parseFloat(m.total_in) - parseFloat(m.total_out);
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{formatMonthShort(m.month)}</TableCell>
                              <TableCell className="text-gray-600">{cur}</TableCell>
                              <TableCell className="text-right text-green-600">{sgn(m.total_in, "+")}{amountOnly(m.total_in, cur)}</TableCell>
                              <TableCell className="text-right text-red-600">{sgn(m.total_out, "-")}{amountOnly(m.total_out, cur)}</TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                {amountOnly(running[cur], cur)}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      {annualReport.by_month.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">Aucun mouvement cette année</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* ============ CUSTOM REPORT ============ */}
        <TabsContent value="custom" className="space-y-4 mt-6 sm:mt-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm min-w-[30px]">Du</Label>
                <Input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="flex-1 sm:w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm min-w-[30px]">Au</Label>
                <Input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="flex-1 sm:w-[160px]"
                />
              </div>
            </div>
            {customReport && (
              <Button onClick={printCustomReport} variant="outline" className="w-full sm:max-w-max">
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : customReport ? (
            <>
              {/* Synthèse par devise */}
              {renderReportSummaryCards(customReport.by_currency)}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Détail par jour</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead className="text-right">Entrées</TableHead>
                        <TableHead className="text-right">Sorties</TableHead>
                        <TableHead className="text-right">Solde cumul</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const running: Record<string, number> = {};
                        (customReport.by_currency || []).forEach((r) => {
                          running[r.currency] = parseFloat(r.opening_balance);
                        });
                        return customReport.by_day.map((day, i) => {
                          const cur = day.currency;
                          if (running[cur] === undefined) running[cur] = 0;
                          running[cur] += parseFloat(day.total_in) - parseFloat(day.total_out);
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{formatDayShort(day.day)}</TableCell>
                              <TableCell className="text-gray-600">{cur}</TableCell>
                              <TableCell className="text-right text-green-600">{sgn(day.total_in, "+")}{amountOnly(day.total_in, cur)}</TableCell>
                              <TableCell className="text-right text-red-600">{sgn(day.total_out, "-")}{amountOnly(day.total_out, cur)}</TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                {amountOnly(running[cur], cur)}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      {customReport.by_day.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">Aucun mouvement sur cette période</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
