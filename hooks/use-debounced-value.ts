"use client";

import { useEffect, useState } from "react";

/**
 * La valeur, une fois que la frappe s'est arrêtée.
 *
 * Écrite trois fois à la main dans l'administration (établissements,
 * utilisateurs, abonnements), avec deux délais différents. Une seule
 * temporisation, 350 ms, celle des pages sœurs du back-office.
 */
export function useDebouncedValue<T>(valeur: T, delai = 350): T {
  const [differee, setDifferee] = useState(valeur);
  useEffect(() => {
    const minuteur = setTimeout(() => setDifferee(valeur), delai);
    return () => clearTimeout(minuteur);
  }, [valeur, delai]);
  return differee;
}
