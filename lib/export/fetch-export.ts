import axios from "@/lib/auth/api-helper";
import { formatApiErrorBody, getErrorBody } from "@/lib/api/drf-error";

/**
 * Fichier d'export tel qu'il traverse la frontière server action.
 *
 * `data` est un tableau de nombres et non un `Buffer` ou un `Uint8Array` :
 * seules les structures sérialisables passent d'une server action au client.
 * C'est le client qui reconstruit le `Blob` (voir `lib/export/download.ts`).
 */
export interface ExportFile {
  data: number[];
  contentType: string;
  filename: string;
}

export type ExportFormat = "pdf" | "xlsx";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * Récupère un rapport binaire depuis le backend et le prépare pour le client.
 *
 * Le backend attend `export_format` et non `format` : ce dernier est réservé par
 * DRF à la négociation de contenu, et comme l'API n'expose que le rendu JSON,
 * un `?format=pdf` répondrait 404 avant même d'atteindre la vue.
 */
export async function fetchExportFile(
  path: string,
  accessToken: string,
  organizationId: string,
  format: ExportFormat,
  params: Record<string, string | number | undefined | null> = {}
): Promise<ExportFile> {
  const query = new URLSearchParams({ export_format: format });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }

  const baseUrl =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8005/api/v1";

  try {
    const response = await axios.get(`${baseUrl}${path}?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Organization-ID": organizationId,
      },
      responseType: "arraybuffer",
    });

    // Une erreur DRF revient en JSON alors qu'on a demandé du binaire : sans
    // cette relecture, l'utilisateur téléchargerait un « PDF » contenant le
    // message d'erreur, illisible dans son lecteur.
    const contentType = (response.headers["content-type"] as string) || "";
    if (contentType.includes("application/json")) {
      const payload = JSON.parse(new TextDecoder().decode(response.data));
      throw new Error(
        formatApiErrorBody(
          payload as Record<string, unknown>,
          "Erreur lors de l'export"
        )
      );
    }

    const disposition =
      (response.headers["content-disposition"] as string) || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);

    return {
      data: Array.from(new Uint8Array(response.data)),
      contentType: CONTENT_TYPES[format],
      filename: match?.[1] || `export.${format}`,
    };
  } catch (error: unknown) {
    console.error(
      `[export] ${path} :`,
      getErrorBody(error) || (error as Error)?.message
    );
    throw error;
  }
}
