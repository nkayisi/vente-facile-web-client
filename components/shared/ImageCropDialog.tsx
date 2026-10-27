"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { COTE_MAX_AVATAR_PX } from "@/lib/uploads";

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  aspectRatio?: number;
  cropShape?: "rect" | "round";
  title?: string;
}

/**
 * La taille de SORTIE du recadrage, plafonnée au côté le plus long.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ SANS CE PLAFOND, LE RECADRAGE RÉ-ENCODAIT À LA TAILLE SOURCE.            │
 * │                                                                          │
 * │ Un carré pris dans une photo de téléphone sortait en plusieurs mégaoctets│
 * │ de JPEG - pour une image affichée au plus à 96 px de côté. Au-delà de la │
 * │ borne du corps d'une server action, l'envoi échouait ; en dessous, il    │
 * │ coûtait des minutes sur une 2G, pour des pixels que personne ne voit.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ ON NE GROSSIT JAMAIS (`facteur` plafonné à 1) : agrandir un petit
 * recadrage alourdirait le fichier sans ajouter un seul détail, et rendrait une
 * image floue là où l'originale était nette.
 */
function tailleDeSortie(largeur: number, hauteur: number) {
  const cote = Math.max(largeur, hauteur);
  const facteur = cote > COTE_MAX_AVATAR_PX ? COTE_MAX_AVATAR_PX / cote : 1;
  return {
    // Au moins 1 px : un arrondi vers le bas sur un recadrage dégénéré donnerait
    // un canevas de taille nulle, que `toBlob` rend vide - donc un envoi qui
    // échoue sans rien dire.
    largeur: Math.max(1, Math.round(largeur * facteur)),
    hauteur: Math.max(1, Math.round(hauteur * facteur)),
  };
}

async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number = 0
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const rotRad = (rotation * Math.PI) / 180;

  const { width: bBoxWidth, height: bBoxHeight } = getRotatedSize(
    image.width,
    image.height,
    rotation
  );

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d")!;

  const sortie = tailleDeSortie(pixelCrop.width, pixelCrop.height);
  croppedCanvas.width = sortie.largeur;
  croppedCanvas.height = sortie.hauteur;

  // Une réduction en un seul passage crénelle sans ce réglage, et l'avatar est
  // la seule image de l'application qu'on regarde de près.
  croppedCtx.imageSmoothingQuality = "high";

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    sortie.largeur,
    sortie.hauteur
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        resolve(file);
      },
      "image/jpeg",
      0.9
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

function getRotatedSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) +
      Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) +
      Math.abs(Math.cos(rotRad) * height),
  };
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
  aspectRatio = 1,
  cropShape = "round",
  title = "Recadrer la photo",
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropAreaComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedFile = await getCroppedImage(
        imageSrc,
        croppedAreaPixels,
        rotation
      );
      onCropComplete(croppedFile);
      onOpenChange(false);
    } catch (error) {
      console.error("Crop error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[350px] bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropAreaComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-gray-400 shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([val]: number[]) => setZoom(val)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-gray-400 shrink-0" />
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCw className="h-4 w-4 text-gray-400 shrink-0" />
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={([val]: number[]) => setRotation(val)}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-10 text-right shrink-0">
              {rotation}°
            </span>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-0">
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
