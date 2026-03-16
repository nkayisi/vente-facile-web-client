"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import {
  getUserOrganizations,
  Organization,
} from "@/actions/organization.actions";
import {
  getDailyReport,
  getMonthlyReport,
  getAnnualReport,
  getCustomReport,
  DailyReport,
  MonthlyReport,
  AnnualReport,
  CustomReport,
} from "@/actions/cashbook.actions";
import {
  createPDFDocument,
  addSummarySection,
  addTable,
  addSignatureSection,
  formatCurrencyForPDF,
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
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          setOrganization(result.data[0]);
        }
      }
    }
    fetchOrganization();
  }, [session]);

  useEffect(() => {
    if (organization && session?.accessToken) {
      if (activeTab === "daily") fetchDailyReport();
      else if (activeTab === "monthly") fetchMonthlyReport();
      else if (activeTab === "annual") fetchAnnualReport();
      else if (activeTab === "custom") fetchCustomReport();
    }
  }, [organization, session, activeTab, selectedDate, selectedYear, selectedMonth, annualYear, customDateFrom, customDateTo, dailyMovementsPage]);

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

  function printDailyReport() {
    if (!dailyReport || !organization) return;

    const { doc, y: startY, pageWidth } = createPDFDocument({
      title: "RAPPORT JOURNALIER DE CAISSE",
      subtitle: `Date: ${formatDateForPDF(selectedDate)}`,
      organizationName: organization.name,
    });

    let y = addSummarySection(doc, startY, pageWidth, [
      { label: "Solde ouverture", value: formatCurrencyForPDF(dailyReport.opening_balance) },
      { label: "Total entrées", value: `+${formatCurrencyForPDF(dailyReport.total_in)}`, color: "green" },
      { label: "Total sorties", value: `-${formatCurrencyForPDF(dailyReport.total_out)}`, color: "red" },
      { label: "Solde clôture", value: formatCurrencyForPDF(dailyReport.closing_balance), color: "blue" },
    ]);

    let runningBalance = parseFloat(dailyReport.opening_balance);
    const tableData = dailyReport.movements.results.map((m) => {
      const amount = parseFloat(m.amount);
      if (m.direction === "in") runningBalance += amount;
      else runningBalance -= amount;
      return [
        new Date(m.movement_date).toLocaleTimeString("fr-CD", { hour: "2-digit", minute: "2-digit" }),
        MOVEMENT_TYPE_LABELS[m.movement_type] || m.movement_type,
        m.description.substring(0, 35),
        m.direction === "in" ? `+${formatCurrencyForPDF(m.amount)}` : "",
        m.direction === "out" ? `-${formatCurrencyForPDF(m.amount)}` : "",
        formatCurrencyForPDF(runningBalance),
      ];
    });

    y = addTable(doc, y, [["Heure", "Type", "Description", "Entrée", "Sortie", "Solde cumul"]], tableData, {
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      highlightColumn: 5,
    });

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

    let y = addSummarySection(doc, startY, pageWidth, [
      { label: "Solde ouverture", value: formatCurrencyForPDF(monthlyReport.opening_balance) },
      { label: "Total entrées", value: `+${formatCurrencyForPDF(monthlyReport.total_in)}`, color: "green" },
      { label: "Total sorties", value: `-${formatCurrencyForPDF(monthlyReport.total_out)}`, color: "red" },
      { label: "Solde clôture", value: formatCurrencyForPDF(monthlyReport.closing_balance), color: "blue" },
    ]);

    let runningBalance = parseFloat(monthlyReport.opening_balance);
    const tableData = monthlyReport.by_day.map((day) => {
      const dayIn = parseFloat(day.total_in);
      const dayOut = parseFloat(day.total_out);
      runningBalance += dayIn - dayOut;
      return [
        formatDateForPDF(day.day),
        `+${formatCurrencyForPDF(day.total_in)}`,
        `-${formatCurrencyForPDF(day.total_out)}`,
        formatCurrencyForPDF(runningBalance),
      ];
    });

    y = addTable(doc, y, [["Date", "Entrées", "Sorties", "Solde cumul"]], tableData, {
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      highlightColumn: 3,
    });

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

    let y = addSummarySection(doc, startY, pageWidth, [
      { label: "Solde ouverture", value: formatCurrencyForPDF(annualReport.opening_balance) },
      { label: "Total entrées", value: `+${formatCurrencyForPDF(annualReport.total_in)}`, color: "green" },
      { label: "Total sorties", value: `-${formatCurrencyForPDF(annualReport.total_out)}`, color: "red" },
      { label: "Solde clôture", value: formatCurrencyForPDF(annualReport.closing_balance), color: "blue" },
    ]);

    let runningBalance = parseFloat(annualReport.opening_balance);
    const tableData = annualReport.by_month.map((m) => {
      const mIn = parseFloat(m.total_in);
      const mOut = parseFloat(m.total_out);
      runningBalance += mIn - mOut;
      return [
        formatMonthForPDF(m.month),
        `+${formatCurrencyForPDF(m.total_in)}`,
        `-${formatCurrencyForPDF(m.total_out)}`,
        formatCurrencyForPDF(runningBalance),
      ];
    });

    y = addTable(doc, y, [["Mois", "Entrées", "Sorties", "Solde cumul"]], tableData, {
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      highlightColumn: 3,
    });

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

    let y = addSummarySection(doc, startY, pageWidth, [
      { label: "Solde ouverture", value: formatCurrencyForPDF(customReport.opening_balance) },
      { label: "Total entrées", value: `+${formatCurrencyForPDF(customReport.total_in)}`, color: "green" },
      { label: "Total sorties", value: `-${formatCurrencyForPDF(customReport.total_out)}`, color: "red" },
      { label: "Solde clôture", value: formatCurrencyForPDF(customReport.closing_balance), color: "blue" },
    ]);

    let runningBalance = parseFloat(customReport.opening_balance);
    const tableData = customReport.by_day.map((day) => {
      const dayIn = parseFloat(day.total_in);
      const dayOut = parseFloat(day.total_out);
      runningBalance += dayIn - dayOut;
      return [
        formatDateForPDF(day.day),
        `+${formatCurrencyForPDF(day.total_in)}`,
        `-${formatCurrencyForPDF(day.total_out)}`,
        formatCurrencyForPDF(runningBalance),
      ];
    });

    y = addTable(doc, y, [["Date", "Entrées", "Sorties", "Solde cumul"]], tableData, {
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      highlightColumn: 3,
    });

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
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-500">
                      Solde d&apos;ouverture
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold">
                      {formatPrice(dailyReport.opening_balance)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-green-600">
                      Total entrées
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-green-600">
                      +{formatPrice(dailyReport.total_in)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-red-600">
                      Total sorties
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-red-600">
                      -{formatPrice(dailyReport.total_out)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-purple-600">
                      Net
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className={`text-lg font-bold ${parseFloat(dailyReport.net) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatPrice(dailyReport.net)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-blue-600">
                      Solde de clôture
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-blue-600">
                      {formatPrice(dailyReport.closing_balance)}
                    </div>
                  </CardContent>
                </Card>
              </div>

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
                              {formatPrice(item.total)}
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
                              {formatPrice(m.amount)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-600">
                              {formatPrice(m.balance_after)}
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
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-500">
                      Solde d&apos;ouverture
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">
                      {formatPrice(monthlyReport.opening_balance)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-green-600">
                      Total entrées
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-green-600">
                      +{formatPrice(monthlyReport.total_in)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-red-600">
                      Total sorties
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-red-600">
                      -{formatPrice(monthlyReport.total_out)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-purple-600">
                      Net
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className={`text-lg font-bold ${parseFloat(monthlyReport.net) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatPrice(monthlyReport.net)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-blue-600">
                      Solde de clôture
                    </CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-blue-600">
                      {formatPrice(monthlyReport.closing_balance)}
                    </div>
                  </CardContent>
                </Card>
              </div>

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
                        <TableHead className="text-right">Entrées</TableHead>
                        <TableHead className="text-right">Sorties</TableHead>
                        <TableHead className="text-right">Solde cumul</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let runningBalance = parseFloat(monthlyReport.opening_balance);
                        return monthlyReport.by_day.map((day, i) => {
                          const dayIn = parseFloat(day.total_in);
                          const dayOut = parseFloat(day.total_out);
                          runningBalance += dayIn - dayOut;
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{formatDayShort(day.day)}</TableCell>
                              <TableCell className="text-right text-green-600">+{formatPrice(day.total_in)}</TableCell>
                              <TableCell className="text-right text-red-600">-{formatPrice(day.total_out)}</TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                {formatPrice(runningBalance)}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      {monthlyReport.by_day.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500">
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-500">Solde d&apos;ouverture</CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold">{formatPrice(annualReport.opening_balance)}</div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-green-600">Total entrées</CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-green-600">+{formatPrice(annualReport.total_in)}</div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-red-600">Total sorties</CardTitle>
                  </CardHeader>
                  <CardContent >
                    <div className="text-lg font-bold text-red-600">-{formatPrice(annualReport.total_out)}</div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-purple-600">Net</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-lg font-bold ${parseFloat(annualReport.net) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatPrice(annualReport.net)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-blue-600">Solde de clôture</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-blue-600">{formatPrice(annualReport.closing_balance)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Détail par mois</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mois</TableHead>
                        <TableHead className="text-right">Entrées</TableHead>
                        <TableHead className="text-right">Sorties</TableHead>
                        <TableHead className="text-right">Solde cumul</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let runningBalance = parseFloat(annualReport.opening_balance);
                        return annualReport.by_month.map((m, i) => {
                          const mIn = parseFloat(m.total_in);
                          const mOut = parseFloat(m.total_out);
                          runningBalance += mIn - mOut;
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{formatMonthShort(m.month)}</TableCell>
                              <TableCell className="text-right text-green-600">+{formatPrice(m.total_in)}</TableCell>
                              <TableCell className="text-right text-red-600">-{formatPrice(m.total_out)}</TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                {formatPrice(runningBalance)}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      {annualReport.by_month.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500">Aucun mouvement cette année</TableCell>
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
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-gray-500">Solde d&apos;ouverture</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{formatPrice(customReport.opening_balance)}</div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-green-600">Total entrées</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-green-600">+{formatPrice(customReport.total_in)}</div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-red-600">Total sorties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-red-600">-{formatPrice(customReport.total_out)}</div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-purple-600">Net</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-lg font-bold ${parseFloat(customReport.net) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatPrice(customReport.net)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="gap-0">
                  <CardHeader>
                    <CardTitle className="text-xs font-medium text-blue-600">Solde de clôture</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-blue-600">{formatPrice(customReport.closing_balance)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Détail par jour</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Entrées</TableHead>
                        <TableHead className="text-right">Sorties</TableHead>
                        <TableHead className="text-right">Solde cumul</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let runningBalance = parseFloat(customReport.opening_balance);
                        return customReport.by_day.map((day, i) => {
                          const dayIn = parseFloat(day.total_in);
                          const dayOut = parseFloat(day.total_out);
                          runningBalance += dayIn - dayOut;
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{formatDayShort(day.day)}</TableCell>
                              <TableCell className="text-right text-green-600">+{formatPrice(day.total_in)}</TableCell>
                              <TableCell className="text-right text-red-600">-{formatPrice(day.total_out)}</TableCell>
                              <TableCell className="text-right font-semibold text-blue-600">
                                {formatPrice(runningBalance)}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                      {customReport.by_day.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500">Aucun mouvement sur cette période</TableCell>
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
