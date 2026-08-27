"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadExportFile, type ExportFile, type ExportFormat } from "@/lib/export/download";

/**
 * Un rapport proposé au téléchargement. Le composant reste ignorant de ce qui
 * est exporté : il reçoit la fonction qui va chercher le fichier.
 */
export interface ExportTarget {
  key: string;
  label: string;
  description?: string;
  run: (format: ExportFormat) => Promise<ExportFile>;
}

interface ExportMenuProps {
  targets: ExportTarget[];
  /** Désactive le menu, par exemple quand la liste affichée est vide */
  disabled?: boolean;
  disabledReason?: string;
  align?: "start" | "end";
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

/**
 * Menu d'export PDF / Excel, partagé par les rubriques de la gestion de stock.
 *
 * Le téléchargement est déclenché depuis le client mais le fichier est fabriqué
 * par le serveur : le menu ne connaît donc jamais la mise en page, seulement le
 * fichier rendu et son nom.
 */
export function ExportMenu({
  targets,
  disabled = false,
  disabledReason = "Rien à exporter pour le moment",
  align = "end",
  variant = "outline",
  size = "sm",
  label = "Exporter",
}: ExportMenuProps) {
  // Une seule clé en vol : on identifie la ligne du menu ET son format, afin
  // que seul le bouton cliqué affiche son indicateur de progression.
  const [pending, setPending] = useState<string | null>(null);

  const handleExport = async (target: ExportTarget, format: ExportFormat) => {
    const token = `${target.key}:${format}`;
    setPending(token);
    try {
      const file = await target.run(format);
      downloadExportFile(file);
      toast.success(
        format === "pdf"
          ? `${target.label} : PDF téléchargé`
          : `${target.label} : fichier Excel téléchargé`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erreur lors de l'export";
      toast.error(message);
    } finally {
      setPending(null);
    }
  };

  const isBusy = pending !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isBusy}
          title={disabled ? disabledReason : undefined}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-64">
        {targets.map((target, index) => (
          <div key={target.key}>
            {index > 0 && <DropdownMenuSeparator />}
            {targets.length > 1 && (
              <DropdownMenuLabel className="text-xs font-medium">
                {target.label}
                {target.description && (
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    {target.description}
                  </span>
                )}
              </DropdownMenuLabel>
            )}
            <DropdownMenuItem
              disabled={isBusy}
              onSelect={(event) => {
                // Sans cela, Radix referme le menu et démonte le composant
                // pendant que la requête est encore en vol.
                event.preventDefault();
                void handleExport(target, "pdf");
              }}
            >
              {pending === `${target.key}:pdf` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Exporter en PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isBusy}
              onSelect={(event) => {
                event.preventDefault();
                void handleExport(target, "xlsx");
              }}
            >
              {pending === `${target.key}:xlsx` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Exporter en Excel
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
