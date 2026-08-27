"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2, TruckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadExportFile, type ExportFormat } from "@/lib/export/download";
import {
  exportStockSupplies,
  type SupplyExportFilters,
} from "@/actions/stock.actions";

interface SupplyExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  organizationId: string;
  /** Période et périmètre hérités des filtres de la liste */
  baseFilters: Pick<
    SupplyExportFilters,
    "warehouse" | "category" | "date_from" | "date_to" | "month"
  >;
  /** Libellé de la période, affiché pour lever toute ambiguïté */
  periodLabel: string;
}

/**
 * Options du rapport d'approvisionnement.
 *
 * La période vient des filtres de la liste ; ce dialogue ne porte que les deux
 * choix propres à ce rapport : d'où viennent les entrées, et comment elles sont
 * regroupées. Les poser dans le menu d'export aurait produit six entrées
 * illisibles.
 */
export function SupplyExportDialog({
  open,
  onOpenChange,
  accessToken,
  organizationId,
  baseFilters,
  periodLabel,
}: SupplyExportDialogProps) {
  const [source, setSource] = useState<"all" | "receipts">("all");
  const [groupBy, setGroupBy] = useState<"product" | "movement">("product");
  const [pending, setPending] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setPending(format);
    try {
      const file = await exportStockSupplies(accessToken, organizationId, format, {
        ...baseFilters,
        source,
        group_by: groupBy,
      });
      downloadExportFile(file);
      toast.success(
        format === "pdf"
          ? "Rapport d'approvisionnement PDF téléchargé"
          : "Rapport d'approvisionnement Excel téléchargé"
      );
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'export"
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TruckIcon className="h-5 w-5 text-orange-500" />
            Rapport d&apos;approvisionnement
          </DialogTitle>
          <DialogDescription>
            Valeur d&apos;achat des entrées de stock sur la période retenue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Période : </span>
            <span className="font-medium">{periodLabel}</span>
          </div>

          <div className="space-y-2">
            <Label>Source des entrées</Label>
            <Select
              value={source}
              onValueChange={(value) => setSource(value as "all" | "receipts")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Toutes les entrées de stock
                </SelectItem>
                <SelectItem value="receipts">
                  Réceptions fournisseur uniquement
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {source === "all"
                ? "Réceptions, stock initial, retours, transferts entrants et ajustements positifs."
                : "Seules les entrées issues d'un bon de réception, avec leur fournisseur."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Présentation</Label>
            <Select
              value={groupBy}
              onValueChange={(value) =>
                setGroupBy(value as "product" | "movement")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">
                  Une ligne par produit (valeur cumulée)
                </SelectItem>
                <SelectItem value="movement">
                  Détail chronologique des entrées
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            disabled={pending !== null}
            onClick={() => void handleExport("pdf")}
          >
            {pending === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            PDF
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            disabled={pending !== null}
            onClick={() => void handleExport("xlsx")}
          >
            {pending === "xlsx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
