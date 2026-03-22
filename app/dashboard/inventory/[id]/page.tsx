"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ArrowLeft,
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Lock,
  Unlock,
  Save,
  Printer,
  Send,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Package,
  Warehouse as WarehouseIcon,
  ClipboardList,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  FileText,
  Timer,
  Ban,
  BarChart3,
  CircleDollarSign,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { formatCurrencyForPDF, formatNumberForPDF, addSignatureSection } from "@/lib/pdf-utils";
import { formatDate, formatDateTime, formatPrice, formatDecimal } from "@/lib/format";
import { useCurrency } from "@/components/providers/currency-provider";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  getInventorySession,
  getInventoryCounts,
  submitInventoryCounts,
  submitForReview,
  validateInventorySession,
  cancelInventorySession,
  startInventorySession,
  getInventoryPrintData,
  InventorySession,
  InventoryCount,
  CountItemData,
  PrintData,
} from "@/actions/inventory.actions";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700", icon: Clock },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-700", icon: Play },
  review: { label: "En révision", color: "bg-orange-100 text-orange-700", icon: Eye },
  validated: { label: "Validé", color: "bg-green-100 text-green-700", icon: CheckCircle },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default function InventoryDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const { currency: defaultCurrency } = useCurrency();
  const sessionId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [inventorySession, setInventorySession] = useState<InventorySession | null>(null);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Local edits for counting
  const [editedCounts, setEditedCounts] = useState<Record<string, { quantity: string; notes: string }>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [countFilter, setCountFilter] = useState<string>("all");

  // Dialogs
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch organization
  useEffect(() => {
    async function fetchOrg() {
      if (session?.accessToken) {
        const result = await getUserOrganizations(session.accessToken);
        if (result.success && result.data && result.data.length > 0) {
          setOrganization(result.data[0]);
        }
      }
    }
    fetchOrg();
  }, [session?.accessToken]);

  // Fetch session and counts
  const fetchData = useCallback(async () => {
    if (!session?.accessToken || !organization?.id) return;
    setIsLoading(true);

    const sessionResult = await getInventorySession(session.accessToken, organization.id, sessionId);
    if (sessionResult.success && sessionResult.data) {
      setInventorySession(sessionResult.data);

      if (sessionResult.data.status !== "draft") {
        const countsResult = await getInventoryCounts(session.accessToken, organization.id, sessionId);
        if (countsResult.success && countsResult.data) {
          setCounts(countsResult.data);
        }
      }
    } else {
      toast.error("Inventaire introuvable");
      router.push("/dashboard/inventory");
    }
    setIsLoading(false);
  }, [session?.accessToken, organization?.id, sessionId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle count input change
  const handleCountChange = (countId: string, value: string) => {
    setEditedCounts((prev) => ({
      ...prev,
      [countId]: { quantity: value, notes: prev[countId]?.notes || "" },
    }));
    setHasUnsavedChanges(true);
  };

  // Handle notes change
  const handleNotesChange = (countId: string, notes: string) => {
    setEditedCounts((prev) => ({
      ...prev,
      [countId]: { quantity: prev[countId]?.quantity || "", notes },
    }));
    setHasUnsavedChanges(true);
  };

  // Save counts
  const handleSaveCounts = async () => {
    if (!session?.accessToken || !organization?.id || !inventorySession) return;

    const countsToSave: CountItemData[] = Object.entries(editedCounts)
      .filter(([_, val]) => val.quantity !== "")
      .map(([id, val]) => ({
        id,
        quantity_counted: parseFloat(val.quantity),
        notes: val.notes || undefined,
      }));

    if (countsToSave.length === 0) {
      toast.error("Aucun comptage à enregistrer");
      return;
    }

    setIsSaving(true);
    const result = await submitInventoryCounts(
      session.accessToken, organization.id, inventorySession.id, countsToSave
    );
    if (result.success) {
      toast.success(`${result.data?.updated_count} comptage(s) enregistré(s)`);
      setEditedCounts({});
      setHasUnsavedChanges(false);
      fetchData();
    } else {
      toast.error(result.message);
    }
    setIsSaving(false);
  };

  // Start session
  const handleStart = async () => {
    if (!session?.accessToken || !organization?.id || !inventorySession) return;
    setIsStarting(true);
    const result = await startInventorySession(session.accessToken, organization.id, inventorySession.id);
    if (result.success) {
      toast.success(result.message);
      setShowStartDialog(false);
      fetchData();
    } else {
      toast.error(result.message);
    }
    setIsStarting(false);
  };

  // Submit for review
  const handleSubmitForReview = async () => {
    if (!session?.accessToken || !organization?.id || !inventorySession) return;
    setIsSubmitting(true);
    const result = await submitForReview(session.accessToken, organization.id, inventorySession.id);
    if (result.success) {
      toast.success(result.message);
      setShowSubmitDialog(false);
      fetchData();
    } else {
      toast.error(result.message);
    }
    setIsSubmitting(false);
  };

  // Validate
  const handleValidate = async () => {
    if (!session?.accessToken || !organization?.id || !inventorySession) return;
    setIsValidating(true);
    const result = await validateInventorySession(session.accessToken, organization.id, inventorySession.id);
    if (result.success) {
      toast.success(result.message);
      setShowValidateDialog(false);
      fetchData();
    } else {
      toast.error(result.message);
    }
    setIsValidating(false);
  };

  // Cancel
  const handleCancel = async () => {
    if (!session?.accessToken || !organization?.id || !inventorySession) return;
    setIsCancelling(true);
    const result = await cancelInventorySession(session.accessToken, organization.id, inventorySession.id);
    if (result.success) {
      toast.success(result.message);
      setShowCancelDialog(false);
      fetchData();
    } else {
      toast.error(result.message);
    }
    setIsCancelling(false);
  };

  // Print inventory sheet as PDF
  const handlePrint = async () => {
    if (!session?.accessToken || !organization?.id || !inventorySession) return;

    const result = await getInventoryPrintData(session.accessToken, organization.id, inventorySession.id);
    if (!result.success || !result.data) {
      toast.error("Erreur lors de la récupération des données d'impression");
      return;
    }

    const data = result.data;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FICHE D'INVENTAIRE", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.session.reference} - ${data.session.name}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    // Info section
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Entrepot:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.warehouse.name} (${data.warehouse.code})`, 35, y);
    doc.setFont("helvetica", "bold");
    doc.text("Imprime le:", pageWidth - 70, y);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(data.printed_at).toLocaleString("fr-CD"), pageWidth - 45, y);
    y += 5;

    if (data.warehouse.address) {
      doc.setFont("helvetica", "bold");
      doc.text("Adresse:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(data.warehouse.address, 35, y);
      y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Statut:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.session.status_display, 30, y);
    doc.setFont("helvetica", "bold");
    doc.text("Par:", pageWidth - 70, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.printed_by, pageWidth - 62, y);
    y += 3;

    doc.setDrawColor(0);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;

    // Tables by category
    Object.entries(data.categories).forEach(([catName, items]) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(catName, 14, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Produit", "SKU", "Stock système", "Compté", "Écart", "Notes"]],
        body: (items as InventoryCount[]).map((item) => [
          item.product_name,
          item.product_sku || "-",
          formatNumberForPDF(item.quantity_expected, 0),
          item.is_counted ? formatNumberForPDF(item.quantity_counted, 0) : "___________",
          item.is_counted ? (parseFloat(item.quantity_difference) > 0 ? "+" : "") + formatNumberForPDF(item.quantity_difference, 0) : "-",
          item.notes || "",
        ]),
        theme: "grid",
        tableWidth: 'auto',
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "right", fontStyle: "bold" },
          4: { halign: "right" },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData) => {
          if (hookData.section === "body" && hookData.column.index === 4) {
            const val = String(hookData.cell.raw);
            if (val.startsWith("+")) hookData.cell.styles.textColor = [22, 163, 74];
            else if (val.startsWith("-")) hookData.cell.styles.textColor = [220, 38, 38];
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    });

    // Summary
    doc.setDrawColor(0);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Resume:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Total produits: ${data.summary.total_products}  |  Comptés: ${data.summary.counted_products}  |  Avec écart: ${data.summary.products_with_difference}` +
      (data.summary.total_difference_value !== "0.00" ? `  |  Écart valeur: ${formatCurrencyForPDF(data.summary.total_difference_value)}` : ""),
      14, y + 5
    );
    y += 15;

    // Signatures (toujours en bas de page)
    addSignatureSection(doc, y, pageWidth, ["Signature compteur", "Signature responsable"]);

    doc.save(`Inventaire_${data.session.reference}.pdf`);
  };

  // Print post-validation report as PDF
  const handlePrintReport = async () => {
    if (!session?.accessToken || !organization?.id || !inventorySession) return;

    const result = await getInventoryPrintData(session.accessToken, organization.id, inventorySession.id);
    if (!result.success || !result.data) {
      toast.error("Erreur lors de la récupération des données du rapport");
      return;
    }

    const data = result.data;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RAPPORT D'INVENTAIRE", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.session.reference} - ${data.session.name}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    // Info section
    doc.setFontSize(9);
    const leftCol = 14;
    const rightCol = pageWidth / 2 + 5;

    doc.setFont("helvetica", "bold");
    doc.text("Entrepot:", leftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.warehouse.name} (${data.warehouse.code})`, leftCol + 22, y);
    doc.setFont("helvetica", "bold");
    doc.text("Statut:", rightCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.session.status_display, rightCol + 16, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Valide le:", leftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(inventorySession.validated_at ? new Date(inventorySession.validated_at).toLocaleString("fr-CD") : "-", leftCol + 22, y);
    doc.setFont("helvetica", "bold");
    doc.text("Valide par:", rightCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(inventorySession.validated_by_name || "-", rightCol + 22, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Imprime le:", leftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(data.printed_at).toLocaleString("fr-CD"), leftCol + 22, y);
    doc.setFont("helvetica", "bold");
    doc.text("Par:", rightCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.printed_by, rightCol + 10, y);
    y += 3;

    doc.setDrawColor(0);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;

    // Summary box
    doc.setFillColor(240, 249, 255);
    doc.roundedRect(14, y, pageWidth - 28, 28, 2, 2, "F");
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Resume des resultats", 20, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Total produits: ${data.summary.total_products}`, 20, y);
    doc.text(`Produits comptes: ${data.summary.counted_products}`, 80, y);
    doc.text(`Avec ecart: ${data.summary.products_with_difference}`, 140, y);
    y += 5;
    doc.text(`Ecart quantite total: ${data.summary.total_difference_quantity}`, 20, y);
    doc.text(`Ecart valeur total: ${data.summary.total_difference_value} ${defaultCurrency.code}`, 80, y);
    y += 12;

    // Only items with differences
    const itemsWithDiff: InventoryCount[] = [];
    Object.values(data.categories).forEach((items) => {
      (items as InventoryCount[]).forEach((item) => {
        if (item.is_counted && parseFloat(item.quantity_difference) !== 0) {
          itemsWithDiff.push(item);
        }
      });
    });

    if (itemsWithDiff.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Produits avec ecart", 14, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Produit", "SKU", "Catégorie", "Stock syst.", "Compté", "Écart", "Valeur écart"]],
        body: itemsWithDiff.map((item) => [
          item.product_name,
          item.product_sku || "-",
          item.product_category_name || "-",
          formatNumberForPDF(item.quantity_expected, 0),
          formatNumberForPDF(item.quantity_counted, 0),
          (parseFloat(item.quantity_difference) > 0 ? "+" : "") + formatNumberForPDF(item.quantity_difference, 0),
          formatCurrencyForPDF(item.difference_value),
        ]),
        theme: "grid",
        tableWidth: 'auto',
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (hookData) => {
          if (hookData.section === "body" && hookData.column.index === 5) {
            const val = String(hookData.cell.raw);
            if (val.startsWith("+")) hookData.cell.styles.textColor = [22, 163, 74];
            else if (val.startsWith("-")) hookData.cell.styles.textColor = [220, 38, 38];
          }
          if (hookData.section === "body" && hookData.column.index === 6) {
            const val = parseFloat(String(hookData.cell.raw).replace(/[^\d,-]/g, "").replace(",", "."));
            if (val > 0) hookData.cell.styles.textColor = [22, 163, 74];
            else if (val < 0) hookData.cell.styles.textColor = [220, 38, 38];
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Aucun ecart detecte - Tous les produits correspondent au stock systeme.", 14, y);
      y += 8;
    }

    // Full inventory table
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Detail complet de l'inventaire", 14, y);
    y += 2;

    const allItems: InventoryCount[] = [];
    Object.values(data.categories).forEach((items) => {
      (items as InventoryCount[]).forEach((item) => allItems.push(item));
    });

    autoTable(doc, {
      startY: y,
      head: [["Produit", "SKU", "Stock système", "Compté", "Écart", "Notes"]],
      body: allItems.map((item) => [
        item.product_name,
        item.product_sku || "-",
        formatNumberForPDF(item.quantity_expected, 0),
        item.is_counted ? formatNumberForPDF(item.quantity_counted, 0) : "-",
        item.is_counted ? (parseFloat(item.quantity_difference) > 0 ? "+" : "") + formatNumberForPDF(item.quantity_difference, 0) : "-",
        item.notes || "",
      ]),
      theme: "grid",
      tableWidth: 'auto',
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 4) {
          const val = String(hookData.cell.raw);
          if (val.startsWith("+")) hookData.cell.styles.textColor = [22, 163, 74];
          else if (val.startsWith("-")) hookData.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Signatures (toujours en bas de page)
    addSignatureSection(doc, y, pageWidth, ["Signature compteur", "Signature responsable"]);

    doc.save(`Rapport_Inventaire_${data.session.reference}.pdf`);
  };

  // Filter counts
  const filteredCounts = counts.filter((c) => {
    if (search) {
      const s = search.toLowerCase();
      if (!c.product_name.toLowerCase().includes(s) && !(c.product_sku || "").toLowerCase().includes(s)) {
        return false;
      }
    }
    if (countFilter === "counted" && !c.is_counted) return false;
    if (countFilter === "uncounted" && c.is_counted) return false;
    if (countFilter === "difference" && (!c.is_counted || parseFloat(c.quantity_difference) === 0)) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!inventorySession) return null;

  const statusCfg = statusConfig[inventorySession.status];
  const StatusIcon = statusCfg?.icon || Clock;
  const isEditable = inventorySession.status === "in_progress";
  const canSubmit = isEditable && inventorySession.items_counted === inventorySession.items_total && inventorySession.items_total > 0;
  const canValidate = inventorySession.status === "review";

  // Compute session duration
  const getSessionDuration = () => {
    const start = inventorySession.started_at ? new Date(inventorySession.started_at) : null;
    if (!start) return null;
    const end = inventorySession.validated_at
      ? new Date(inventorySession.validated_at)
      : inventorySession.status === "cancelled"
        ? new Date(inventorySession.updated_at || inventorySession.created_at)
        : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) return `${hours}h ${mins > 0 ? `${mins}min` : ""}`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}j ${remHours > 0 ? `${remHours}h` : ""}`;
  };
  const sessionDuration = getSessionDuration();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{inventorySession.name}</h1>
              <Badge className={`${statusCfg?.color} shrink-0`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusCfg?.label}
              </Badge>
              {inventorySession.is_stock_locked && (
                <Badge variant="outline" className="text-red-600 border-red-200 shrink-0">
                  <Lock className="h-3 w-3 mr-1" />
                  Stock verrouillé
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
              <span className="font-mono">{inventorySession.reference}</span>
              <span className="flex items-center gap-1">
                <WarehouseIcon className="h-3.5 w-3.5" />
                {inventorySession.warehouse_name}
              </span>
              <span>{inventorySession.scope_type_display}</span>
              {inventorySession.created_by_name && <span>Par {inventorySession.created_by_name}</span>}
              <span>{formatDate(inventorySession.created_at)}</span>
              {sessionDuration && (
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {sessionDuration}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {inventorySession.status === "draft" && (
            <Button onClick={() => setShowStartDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Play className="h-4 w-4 mr-2" />
              Démarrer l'inventaire
            </Button>
          )}
          {isEditable && (
            <>
              {hasUnsavedChanges ? (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <Save className="h-3.5 w-3.5" />
                  Enregistrez vos modifications avant de soumettre
                </p>
              ) : inventorySession.items_counted < inventorySession.items_total ? (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {inventorySession.items_total - inventorySession.items_counted} produit(s) restant(s) à compter
                </p>
              ) : canSubmit ? (
                <Button onClick={() => setShowSubmitDialog(true)} className="bg-orange-500 hover:bg-orange-600">
                  <Send className="h-4 w-4 mr-2" />
                  Soumettre pour révision
                </Button>
              ) : null}
            </>
          )}
          {canValidate && (
            <Button onClick={() => setShowValidateDialog(true)} className="bg-green-600 hover:bg-green-700">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Valider et appliquer
            </Button>
          )}
          {inventorySession.status !== "draft" && (
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer la fiche
            </Button>
          )}
          {inventorySession.status === "validated" && (
            <Button variant="outline" onClick={handlePrintReport}>
              <FileText className="h-4 w-4 mr-2" />
              Imprimer le rapport
            </Button>
          )}
          {(inventorySession.status === "in_progress" || inventorySession.status === "review") && (
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowCancelDialog(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Summary + Progress */}
      {inventorySession.status !== "draft" && (
        <Card className="py-0">
          <CardContent className="p-4 space-y-4">
            {/* Progress bar - shown for in_progress */}
            {inventorySession.status === "in_progress" && inventorySession.items_total > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600 font-medium">Progression du comptage</span>
                  <span className="font-semibold">
                    {inventorySession.items_counted}/{inventorySession.items_total}
                    <span className="text-gray-400 ml-1">({inventorySession.progress_percentage}%)</span>
                  </span>
                </div>
                <Progress value={inventorySession.progress_percentage} className="h-2.5" />
                {inventorySession.items_total - inventorySession.items_counted > 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    {inventorySession.items_total - inventorySession.items_counted} produit(s) restant(s) à compter
                  </p>
                )}
              </div>
            )}
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <Package className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-tight">{inventorySession.items_total}</p>
                  <p className="text-xs text-gray-500">Produits</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-3">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-tight text-blue-600">{inventorySession.items_counted}</p>
                  <p className="text-xs text-gray-500">Comptés</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-orange-50 rounded-lg p-3">
                <div className="p-2 bg-orange-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-tight text-orange-600">{inventorySession.items_with_difference}</p>
                  <p className="text-xs text-gray-500">Écarts</p>
                </div>
              </div>
              {/* Écart quantité */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <ArrowUpDown className="h-4 w-4 text-gray-600" />
                  </div>
                  <p className="text-xs font-medium text-gray-600">Écart quantité</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-100 rounded p-1">
                    <p className="text-xs text-center text-green-600">
                      +{formatDecimal(counts.filter(c => c.is_counted && parseFloat(c.quantity_difference) > 0).reduce((sum, c) => sum + parseFloat(c.quantity_difference), 0))}
                    </p>
                  </div>
                  <div className="bg-red-100 rounded p-1">
                    <p className="text-xs text-center text-red-600">
                      {formatDecimal(counts.filter(c => c.is_counted && parseFloat(c.quantity_difference) < 0).reduce((sum, c) => sum + parseFloat(c.quantity_difference), 0))}
                    </p>
                  </div>
                </div>
              </div>
              {/* Écart valeur */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-gray-200 rounded-lg">
                    <CircleDollarSign className="h-4 w-4 text-gray-600" />
                  </div>
                  <p className="text-xs font-medium text-gray-600">Écart valeur</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-100 rounded p-1">
                    <p className="text-xs text-center text-green-600">
                      +{formatPrice(counts.filter(c => c.is_counted && parseFloat(c.difference_value) > 0).reduce((sum, c) => sum + parseFloat(c.difference_value), 0))}
                    </p>
                  </div>
                  <div className="bg-red-100 rounded p-1">
                    <p className="text-xs text-center text-red-600">
                      {formatPrice(counts.filter(c => c.is_counted && parseFloat(c.difference_value) < 0).reduce((sum, c) => sum + parseFloat(c.difference_value), 0))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {inventorySession.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 font-medium mb-1">Notes</p>
            <p className="text-sm text-gray-700">{inventorySession.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Draft state */}
      {inventorySession.status === "draft" && (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Inventaire en brouillon</h3>
            <p className="text-gray-500 mb-4">
              Démarrez l'inventaire pour générer les lignes de comptage et verrouiller le stock.
            </p>
            <Button onClick={() => setShowStartDialog(true)} className="bg-blue-600 hover:bg-blue-700">
              <Play className="h-4 w-4 mr-2" />
              Démarrer l'inventaire
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Count Table */}
      {inventorySession.status !== "draft" && counts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">Lignes de comptage</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={countFilter} onValueChange={setCountFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="uncounted">Non comptés</SelectItem>
                    <SelectItem value="counted">Comptés</SelectItem>
                    <SelectItem value="difference">Avec écart</SelectItem>
                  </SelectContent>
                </Select>
                {isEditable && hasUnsavedChanges && (
                  <Button onClick={handleSaveCounts} disabled={isSaving} size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0">
                    {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Enregistrer
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                    <TableHead className="text-right">Stock système</TableHead>
                    <TableHead className="text-right">
                      {isEditable ? "Quantité comptée" : "Compté"}
                    </TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Valeur écart</TableHead>
                    <TableHead className="hidden lg:table-cell">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCounts.map((count) => {
                    const edited = editedCounts[count.id];
                    const diff = count.is_counted ? parseFloat(count.quantity_difference) : 0;
                    const diffValue = count.is_counted ? parseFloat(count.difference_value) : 0;

                    return (
                      <TableRow key={count.id} className={!count.is_counted && !isEditable ? "opacity-50" : ""}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{count.product_name}</p>
                            {count.product_sku && (
                              <p className="text-xs text-gray-400 font-mono">{count.product_sku}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-gray-500">
                          {count.product_category_name || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatDecimal(count.quantity_expected)}
                          {count.unit_name && <span className="text-gray-400 ml-1">{count.unit_name}</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditable ? (
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              className="w-24 text-right ml-auto"
                              placeholder="0"
                              value={edited?.quantity ?? (count.is_counted ? parseFloat(count.quantity_counted).toString() : "")}
                              onChange={(e) => handleCountChange(count.id, e.target.value)}
                            />
                          ) : (
                            <span className={`font-mono text-sm ${count.is_counted ? "font-semibold" : "text-gray-400"}`}>
                              {count.is_counted ? formatDecimal(count.quantity_counted) : "-"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {count.is_counted ? (
                            <span className={`font-mono text-sm font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-500"}`}>
                              {diff > 0 ? "+" : ""}{formatDecimal(count.quantity_difference)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {count.is_counted && diffValue !== 0 ? (
                            <span className={`text-sm ${diffValue > 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatPrice(count.difference_value)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {isEditable ? (
                            <Input
                              className="w-32 text-sm"
                              placeholder="Notes..."
                              value={edited?.notes ?? (count.notes || "")}
                              onChange={(e) => handleNotesChange(count.id, e.target.value)}
                            />
                          ) : (
                            <span className="text-sm text-gray-500">{count.notes || "-"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Aucun produit trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validated info */}
      {inventorySession.status === "validated" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">Inventaire validé</p>
                  <p className="text-sm text-green-700">
                    Validé le {inventorySession.validated_at ? formatDateTime(inventorySession.validated_at) : "-"}
                    {inventorySession.validated_by_name && ` par ${inventorySession.validated_by_name}`}.
                    Les ajustements de stock ont été appliqués.
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-green-700">
                    <span>{inventorySession.items_total} produit(s) inventorié(s)</span>
                    {inventorySession.items_with_difference > 0 && (
                      <span className="font-medium">{inventorySession.items_with_difference} écart(s) détecté(s)</span>
                    )}
                    {sessionDuration && <span>Durée : {sessionDuration}</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-100" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Fiche
                </Button>
                <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-100" onClick={handlePrintReport}>
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Rapport
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancelled info */}
      {inventorySession.status === "cancelled" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Ban className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Inventaire annulé</p>
                <p className="text-sm text-red-700">
                  Cet inventaire a été annulé. Le stock a été déverrouillé et aucun ajustement n&apos;a été appliqué.
                  {sessionDuration && ` Durée avant annulation : ${sessionDuration}.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Start Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Démarrer l'inventaire</DialogTitle>
            <DialogDescription>
              Le stock sera verrouillé pour les produits concernés dans l'entrepôt "{inventorySession.warehouse_name}".
            </DialogDescription>
          </DialogHeader>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Stock verrouillé pendant l'inventaire</p>
              <p>Les ventes et mouvements de stock seront bloqués pour ces produits jusqu'à la fin.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Annuler</Button>
            <Button onClick={handleStart} disabled={isStarting} className="bg-blue-600 hover:bg-blue-700">
              {isStarting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Lock className="h-4 w-4 mr-2" />
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soumettre pour révision</DialogTitle>
            <DialogDescription>
              Tous les produits ont été comptés. Soumettez l'inventaire pour révision avant validation.
            </DialogDescription>
          </DialogHeader>
          {inventorySession.items_with_difference > 0 && (() => {
            // Calculer les écarts positifs et négatifs
            const positiveValue = counts
              .filter(c => c.is_counted && parseFloat(c.difference_value) > 0)
              .reduce((sum, c) => sum + parseFloat(c.difference_value), 0);
            const negativeValue = counts
              .filter(c => c.is_counted && parseFloat(c.difference_value) < 0)
              .reduce((sum, c) => sum + parseFloat(c.difference_value), 0);
            const positiveCount = counts.filter(c => c.is_counted && parseFloat(c.quantity_difference) > 0).length;
            const negativeCount = counts.filter(c => c.is_counted && parseFloat(c.quantity_difference) < 0).length;

            return (
              <div className="space-y-3">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">{inventorySession.items_with_difference} produit(s) avec écart</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Écart positif (surplus) */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Plus className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Surplus</span>
                    </div>
                    <p className="text-lg font-bold text-green-600">+{formatPrice(positiveValue)}</p>
                    <p className="text-xs text-green-700">{positiveCount} produit(s) en plus</p>
                  </div>

                  {/* Écart négatif (manquant) */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Minus className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800">Manquant</span>
                    </div>
                    <p className="text-lg font-bold text-red-600">{formatPrice(negativeValue)}</p>
                    <p className="text-xs text-red-700">{negativeCount} produit(s) en moins</p>
                  </div>
                </div>

                {/* Écart net */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-600">Écart net en valeur</p>
                  <p className={`text-xl font-bold ${parseFloat(inventorySession.total_difference_value) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(inventorySession.total_difference_value) >= 0 ? '+' : ''}{formatPrice(inventorySession.total_difference_value)}
                  </p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Annuler</Button>
            <Button onClick={handleSubmitForReview} disabled={isSubmitting} className="bg-orange-500 hover:bg-orange-600">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validate Dialog */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider l'inventaire</DialogTitle>
            <DialogDescription>
              Cette action va appliquer les ajustements de stock et déverrouiller le stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {inventorySession.items_with_difference > 0 && (() => {
              // Calculer les écarts positifs et négatifs
              const positiveQty = counts
                .filter(c => c.is_counted && parseFloat(c.quantity_difference) > 0)
                .reduce((sum, c) => sum + parseFloat(c.quantity_difference), 0);
              const negativeQty = counts
                .filter(c => c.is_counted && parseFloat(c.quantity_difference) < 0)
                .reduce((sum, c) => sum + parseFloat(c.quantity_difference), 0);
              const positiveValue = counts
                .filter(c => c.is_counted && parseFloat(c.difference_value) > 0)
                .reduce((sum, c) => sum + parseFloat(c.difference_value), 0);
              const negativeValue = counts
                .filter(c => c.is_counted && parseFloat(c.difference_value) < 0)
                .reduce((sum, c) => sum + parseFloat(c.difference_value), 0);

              return (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <p className="font-medium mb-2">Résumé des ajustements :</p>
                    <p>{inventorySession.items_with_difference} produit(s) avec écart</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Quantité en plus */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Plus className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Qté surplus</span>
                      </div>
                      <p className="text-lg font-bold text-green-600">+{formatDecimal(positiveQty)}</p>
                    </div>

                    {/* Quantité en moins */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Minus className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Qté manquant</span>
                      </div>
                      <p className="text-lg font-bold text-red-600">{formatDecimal(negativeQty)}</p>
                    </div>

                    {/* Valeur en plus */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CircleDollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Valeur surplus</span>
                      </div>
                      <p className="text-lg font-bold text-green-600">+{formatPrice(positiveValue)}</p>
                    </div>

                    {/* Valeur en moins */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CircleDollarSign className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">Valeur manquant</span>
                      </div>
                      <p className="text-lg font-bold text-red-600">{formatPrice(negativeValue)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-3">
              <Unlock className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">Le stock sera déverrouillé</p>
                <p>Les mouvements de stock redeviendront possibles pour ces produits.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)}>Annuler</Button>
            <Button onClick={handleValidate} disabled={isValidating} className="bg-green-600 hover:bg-green-700">
              {isValidating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <ShieldCheck className="h-4 w-4 mr-2" />
              Valider et appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler l'inventaire</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le stock sera déverrouillé et les comptages perdus.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Tous les comptages seront perdus</p>
              <p>Vous devrez recommencer un nouvel inventaire.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Retour</Button>
            <Button onClick={handleCancel} disabled={isCancelling} variant="destructive">
              {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Annuler l'inventaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
