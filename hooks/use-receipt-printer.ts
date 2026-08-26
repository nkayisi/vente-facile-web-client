"use client";

/**
 * Impression d'un ticket, du clic au PDF présenté.
 *
 * Absorbe la séquence qui était copiée-collée dans cinq pages, message de toast
 * compris : ouvrir l'onglet sur le geste, appeler l'API, construire le document,
 * l'envoyer dans l'onglet, prévenir l'utilisateur. Les divergences entre copies
 * (une page qui n'imprimait pas, une autre qui ignorait la largeur de papier)
 * venaient précisément de cette duplication.
 *
 * L'onglet doit être ouvert AVANT l'appel réseau, sinon le navigateur le bloque.
 * D'où la forme en deux temps : `begin()` sur le clic, `present()` une fois la
 * réponse obtenue, `abort()` si l'opération échoue.
 */

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Block } from "@/lib/receipt/blocks";
import {
  assignToPrintTab,
  closePrintTab,
  openPrintTab,
  presentMessage,
} from "@/lib/receipt/present";
import { renderReceiptUrl } from "@/lib/receipt/render-pdf";
import type { PaperWidth } from "@/lib/receipt/tokens";

export interface PrintJob {
  /** Rend les blocs et les envoie dans l'onglet ouvert au clic. */
  present: (
    blocks: Block[],
    options: { filename: string; paperWidth?: PaperWidth; successMessage?: string }
  ) => void;
  /** Referme l'onglet : validation refusée, appel en échec, opération annulée. */
  abort: () => void;
}

export function useReceiptPrinter() {
  const openTabs = useRef<Set<Window>>(new Set());

  // Un onglet vierge laissé ouvert par un démontage de page (navigation pendant
  // l'appel réseau) resterait sur `about:blank` sans que rien ne le referme.
  useEffect(() => {
    const tabs = openTabs.current;
    return () => {
      tabs.forEach((tab) => closePrintTab(tab));
      tabs.clear();
    };
  }, []);

  const begin = useCallback((): PrintJob => {
    const tab = openPrintTab();
    if (tab) openTabs.current.add(tab);

    const forget = () => {
      if (tab) openTabs.current.delete(tab);
    };

    return {
      present: (blocks, options) => {
        forget();
        try {
          const url = renderReceiptUrl(blocks, options.paperWidth ?? 58);
          const result = assignToPrintTab(tab, url, options.filename);
          toast.success(options.successMessage ?? "Reçu généré", {
            description: presentMessage(result),
          });
        } catch (error) {
          console.error("[Reçu] Génération impossible", error);
          closePrintTab(tab);
          // L'opération métier, elle, a réussi : on ne doit pas laisser croire
          // le contraire parce que le ticket n'est pas sorti.
          toast.error("Le reçu n'a pas pu être généré", {
            description: "L'opération est bien enregistrée. Réimprimez depuis son détail.",
          });
        }
      },
      abort: () => {
        forget();
        closePrintTab(tab);
      },
    };
  }, []);

  return { begin };
}
