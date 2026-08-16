"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Au-delà, l'envoi devient lent sur les connexions du terrain. */
const TAILLE_MAX_MO = 5;

interface ProductImageFieldProps {
  /** Photo déjà enregistrée, affichée tant qu'aucune nouvelle n'est choisie. */
  currentUrl?: string | null;
  /** Reçoit le fichier choisi, ou `null` quand la photo est retirée. */
  onChange: (file: File | null) => void;
  error?: string;
  /** Vrai quand l'utilisateur demande le retrait de la photo enregistrée. */
  onRemoveExisting?: () => void;
}

/**
 * Champ photo du produit, partagé par la création et la modification.
 *
 * La photo sert surtout au caissier, qui repère un produit plus vite à l'image
 * qu'au nom dans une grille de plusieurs centaines d'articles.
 */
export function ProductImageField({
  currentUrl,
  onChange,
  error,
  onRemoveExisting,
}: ProductImageFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = preview ?? currentUrl ?? null;
  const message = error ?? localError;

  const handleFile = (file: File | null) => {
    if (!file) {
      setPreview(null);
      setLocalError(null);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      if (currentUrl) onRemoveExisting?.();
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLocalError("Choisissez un fichier image");
      return;
    }
    if (file.size > TAILLE_MAX_MO * 1024 * 1024) {
      setLocalError(`La photo ne doit pas dépasser ${TAILLE_MAX_MO} Mo`);
      return;
    }
    setLocalError(null);
    setPreview(URL.createObjectURL(file));
    onChange(file);
  };

  return (
    <div className="flex items-start gap-4">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
        {shown ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shown}
              alt="Aperçu du produit"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleFile(null)}
              aria-label="Retirer la photo"
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/75"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <label
            htmlFor="image"
            className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-500"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Photo</span>
          </label>
        )}
      </div>

      <div className="flex-1 space-y-1 pt-1">
        <Label htmlFor="image">Photo du produit</Label>
        <Input
          id="image"
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="cursor-pointer"
        />
        <p className="text-xs text-gray-500">
          Facultatif. JPG ou PNG, {TAILLE_MAX_MO} Mo maximum.
        </p>
        {message && <p className="text-sm text-red-500">{message}</p>}
      </div>
    </div>
  );
}
