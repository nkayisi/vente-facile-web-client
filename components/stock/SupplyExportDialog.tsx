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
import { type ExportFormat } from "@/lib/export/download";
import { ExportMenu } from "@/components/shared/ExportMenu";
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
  /**
   * `ExportMenu` porte l'attente, le téléchargement et le message : il ne
   * reste ici que d'aller chercher le fichier, avec les deux choix du dialogue.
   */
  const lancerExport = async (format: ExportFormat) => {
    const file = await exportStockSupplies(accessToken, organizationId, format, {
      ...baseFilters,
      source,
      group_by: groupBy,
    });
    onOpenChange(false);
    return file;
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

        {/* Deux boutons en dur laissaient de côté le CSV, seul export du
            produit à ne pas l'offrir. `ExportMenu` porte les trois formats et
            son propre indicateur d'attente. */}
        <DialogFooter className="gap-2 sm:gap-2">
          <ExportMenu
            targets={[
              {
                key: "approvisionnement",
                label: "Approvisionnement",
                run: (format) => lancerExport(format),
              },
            ]}
            variant="default"
            size="default"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
