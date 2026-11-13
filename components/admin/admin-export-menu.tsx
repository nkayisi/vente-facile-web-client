"use client";

/**
 * Le menu d'export d'une liste de l'administration.
 *
 * ⚠ IL N'APPARAÎT QU'AVEC `exports.run`, réservé au super-administrateur. Un
 *   fichier emporte la liste de TOUS les marchands hors de l'application, ce
 *   qu'aucune consultation ne fait : le support lit, il n'emporte pas. Un bouton
 *   qui répondrait 403 après le choix du format est pire qu'aucun bouton.
 *
 * ⚠ LE FICHIER PORTE LES FILTRES DE L'ÉCRAN, JAMAIS LA PAGE AFFICHÉE : on
 *   transmet les filtres, et c'est le serveur qui parcourt tout le périmètre.
 *   `page` et `page_size` ne sont donc jamais envoyés.
 */
import { useSession } from "next-auth/react";

import { exportAdminList, type AdminExportList } from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { ExportMenu } from "@/components/shared/ExportMenu";
import type { ExportFormat } from "@/lib/export/download";

type Filtres = Record<string, string | number | undefined | null>;

export function AdminExportMenu({
  liste,
  libelle,
  filtres = {},
  vide = false,
}: {
  liste: AdminExportList;
  /** Ce que le fichier contient, dit au toast de réussite. */
  libelle: string;
  filtres?: Filtres;
  /** La liste affichée est vide : il n'y aurait rien dans le fichier. */
  vide?: boolean;
}) {
  const { data: session } = useSession();
  const { hasPlatformPermission } = useAdminPermissions();
  if (!hasPlatformPermission("exports.run")) return null;

  const { page: _page, page_size: _taille, ...perimetre } = filtres;
  void _page;
  void _taille;

  return (
    <ExportMenu
      size="default"
      disabled={vide}
      disabledReason="Aucune ligne ne correspond aux filtres"
      targets={[
        {
          key: liste,
          label: libelle,
          run: async (format: ExportFormat) => {
            const jeton = session?.accessToken;
            if (!jeton) throw new Error("Session expirée, reconnectez-vous.");
            const r = await exportAdminList(jeton, liste, format, perimetre);
            if (!r.success || !r.data) throw new Error(r.message || "L'export n'a pas pu être préparé");
            return r.data;
          },
        },
      ]}
    />
  );
}
