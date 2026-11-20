"use client";

/**
 * Scanner un code-barres ou un QR avec la caméra, au point de vente.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ L'API DU NAVIGATEUR N'EXISTE PAS PARTOUT, D'OÙ LE DÉCODEUR EMBARQUÉ.     │
 * │                                                                          │
 * │ `BarcodeDetector` n'est fourni ni par Chrome sous Windows ni par         │
 * │ Firefox : on emploie le ponyfill `barcode-detector` (ZXing en            │
 * │ WebAssembly), chargé à l'ouverture seulement pour ne rien coûter au      │
 * │ point de vente tant que la caméra ne sert pas. Son `.wasm` est servi par │
 * │ le site (`public/zxing/`, contrôlé par `pnpm check:zxing`), pas par un   │
 * │ CDN qu'un réseau de comptoir peut filtrer.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Montée à l'ouverture seulement : la caméra s'éteint au démontage, et chaque
 * ouverture repart d'un flux neuf.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Ce qu'un commerce scanne : codes de détail, codes logistiques, QR. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] as const;

/** L'intervalle entre deux lectures d'image : assez vif, sans chauffer le poste. */
const INTERVALLE_MS = 150;

function messageDErreur(erreur: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "La caméra exige une connexion sécurisée (https). Utilisez une douchette, ou ouvrez le point de vente en https.";
  }
  const nom = erreur instanceof DOMException ? erreur.name : "";
  if (nom === "NotAllowedError" || nom === "SecurityError") {
    return "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, puis réessayez.";
  }
  if (nom === "NotFoundError" || nom === "OverconstrainedError") {
    return "Aucune caméra n'a été trouvée sur ce poste.";
  }
  if (nom === "NotReadableError") {
    return "La caméra est déjà utilisée par une autre application.";
  }
  return "La caméra n'a pas pu démarrer. Utilisez une douchette ou tapez le code.";
}

export function ScanCameraDialog({
  onCode,
  onClose,
}: {
  /** Le code lu : la boîte se ferme d'elle-même. */
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [etat, setEtat] = useState<"demarrage" | "lecture" | "erreur">("demarrage");
  const [erreur, setErreur] = useState<string | null>(null);
  // Le rappel le plus récent, sans relancer la caméra à chaque rendu du parent.
  const rappel = useRef(onCode);
  useEffect(() => {
    rappel.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let arrete = false;
    let flux: MediaStream | null = null;
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("contexte non sécurisé");
        }
        const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
        prepareZXingModule({
          overrides: {
            locateFile: (chemin: string, prefixe: string) =>
              chemin.endsWith(".wasm") ? `/zxing/${chemin}` : prefixe + chemin,
          },
        });
        const detecteur = new BarcodeDetector({ formats: [...FORMATS] });

        flux = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (arrete || !video.current) return;
        video.current.srcObject = flux;
        await video.current.play();
        if (arrete) return;
        setEtat("lecture");

        const lire = async () => {
          if (arrete || !video.current) return;
          try {
            const codes = await detecteur.detect(video.current);
            const lu = codes.find((c) => c.rawValue?.trim())?.rawValue.trim();
            if (lu && !arrete) {
              arrete = true;
              rappel.current(lu);
              return;
            }
          } catch {
            // Une image illisible (vidéo pas encore prête) : on réessaie.
          }
          minuteur = setTimeout(lire, INTERVALLE_MS);
        };
        void lire();
      } catch (e) {
        if (arrete) return;
        setErreur(messageDErreur(e));
        setEtat("erreur");
      }
    })();

    return () => {
      arrete = true;
      if (minuteur) clearTimeout(minuteur);
      flux?.getTracks().forEach((piste) => piste.stop());
    };
  }, []);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scanner un article</DialogTitle>
          <DialogDescription>
            Présentez le code-barres ou le QR de l&apos;article devant la caméra.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
          <video ref={video} className="h-full w-full object-cover" muted playsInline />
          {etat === "demarrage" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Démarrage de la caméra…
            </div>
          )}
          {etat === "lecture" && (
            // Le cadre de visée : il dit où poser le code, rien de plus.
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80"
            />
          )}
          {etat === "erreur" && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
              {erreur}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
