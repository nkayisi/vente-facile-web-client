"use client";

/**
 * Le choix d'un administrateur de la plateforme, pour filtrer une liste.
 *
 * Lu par le journal d'audit et par la page des prises en main : la liste se
 * charge ici, une fois, plutôt que dans chaque page qui veut filtrer par auteur.
 * La valeur est l'identifiant du COMPTE (`user_id`), celui que le serveur filtre.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPlatformAdmins, type PlatformAdminProfile } from "@/actions/admin.actions";

/** La valeur de l'entrée « tous » : jamais un identifiant de compte. */
export const TOUS_LES_ADMINISTRATEURS = "all";

interface Props {
  value: string;
  onChange: (valeur: string) => void;
  /** Le libellé de l'entrée qui ne filtre rien. */
  libelleTous: string;
  ariaLabel: string;
}

export function AdministrateurSelect({ value, onChange, libelleTous, ariaLabel }: Props) {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const [admins, setAdmins] = useState<PlatformAdminProfile[]>([]);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const r = await getPlatformAdmins(jeton);
      if (!annule && r.success && r.data) setAdmins(r.data.results);
    })();
    return () => {
      annule = true;
    };
  }, [jeton]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" aria-label={ariaLabel}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={TOUS_LES_ADMINISTRATEURS}>{libelleTous}</SelectItem>
        {admins.map((a) => (
          <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
