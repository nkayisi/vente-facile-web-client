"use client";

/**
 * La recherche globale de l'administration : établissements, comptes, paiements.
 *
 * Ouverte par Ctrl+K (⌘K) ou par le champ de l'en-tête. Le support décroche avec
 * un nom, un numéro de téléphone ou une référence de paiement en tête : il ne
 * doit pas avoir à deviner dans quelle liste chercher.
 *
 * ⚠ LE SERVEUR FILTRE, PAS `cmdk` (`shouldFilter={false}`). Le filtre local de
 *   `cmdk` réordonnerait et masquerait les résultats sur leur libellé, alors que
 *   le serveur a cherché aussi dans les courriels et les téléphones : un compte
 *   trouvé par son numéro disparaîtrait de la liste.
 *
 * ⚠ UN GROUPE À `null` N'EST PAS AFFICHÉ : c'est un domaine que le rôle ne lit
 *   pas, et « aucun résultat » y mentirait.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, CreditCard, Loader2, Search, User } from "lucide-react";

import { searchAdmin, type AdminSearchHit, type AdminSearchResults } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const GROUPES = [
  { cle: "organizations", titre: "Établissements", icone: Building2 },
  { cle: "users", titre: "Comptes", icone: User },
  { cle: "payments", titre: "Paiements", icone: CreditCard },
] as const;

/** Où mène un résultat. Un paiement ouvre la liste des paiements, sur sa référence. */
function destination(groupe: (typeof GROUPES)[number]["cle"], hit: AdminSearchHit): string {
  if (groupe === "organizations") return `/admin/organizations/${hit.id}`;
  if (groupe === "users") return `/admin/users/${hit.id}`;
  // Un paiement sans référence porte son identifiant pour nom, que la liste ne
  // sait pas chercher : on l'ouvre alors sur son établissement.
  if (hit.name === hit.id && hit.organization) return `/admin/payments?organization=${hit.organization}`;
  return `/admin/payments?search=${encodeURIComponent(hit.name)}`;
}

export function AdminSearch() {
  const router = useRouter();
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const q = useDebouncedValue(saisie.trim(), 250);
  const [resultats, setResultats] = useState<AdminSearchResults | null>(null);
  const [cherche, setCherche] = useState(false);

  // Ctrl+K / ⌘K, partout dans l'administration.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOuvert((o) => !o);
      }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, []);

  useEffect(() => {
    if (!jeton || q.length < 2) return;
    let vivant = true;
    searchAdmin(jeton, q)
      .then((r) => {
        if (vivant) setResultats(r.success && r.data ? r.data : null);
      })
      .finally(() => {
        if (vivant) setCherche(false);
      });
    return () => {
      // ⚠ Une réponse arrivée après une frappe plus récente ne remplace pas
      //   les résultats de celle-ci.
      vivant = false;
    };
  }, [jeton, q]);

  const changer = (valeur: string) => {
    setSaisie(valeur);
    if (valeur.trim().length >= 2) setCherche(true);
    else setResultats(null);
  };

  const ouvrir = (chemin: string) => {
    setOuvert(false);
    setSaisie("");
    setResultats(null);
    router.push(chemin);
  };

  const affiches = q.length >= 2 ? resultats : null;
  const rien =
    affiches !== null &&
    GROUPES.every((g) => !affiches[g.cle] || affiches[g.cle]!.length === 0);

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-full max-w-xs justify-start gap-2 text-muted-foreground"
        onClick={() => setOuvert(true)}
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate text-left text-sm">Rechercher</span>
        <kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </Button>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Recherche globale</DialogTitle>
          <DialogDescription className="sr-only">
            Cherchez un établissement, un compte ou un paiement par son nom, son courriel, son téléphone ou sa référence.
          </DialogDescription>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Établissement, courriel, téléphone, référence de paiement"
              value={saisie}
              onValueChange={changer}
            />
            <CommandList className="max-h-96">
              {saisie.trim().length < 2 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Tapez au moins deux caractères.
                </p>
              ) : cherche && !affiches ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : null}
              {rien ? <CommandEmpty>Aucun résultat pour « {q} ».</CommandEmpty> : null}
              {affiches
                ? GROUPES.map(({ cle, titre, icone: Icone }) => {
                    const hits = affiches[cle];
                    if (!hits || hits.length === 0) return null;
                    return (
                      <CommandGroup key={cle} heading={titre}>
                        {hits.map((hit) => (
                          <CommandItem
                            key={`${cle}-${hit.id}`}
                            value={`${cle}-${hit.id}`}
                            onSelect={() => ouvrir(destination(cle, hit))}
                          >
                            <Icone className="h-4 w-4 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{hit.name}</p>
                              {hit.detail ? (
                                <p className="truncate text-xs text-muted-foreground">{hit.detail}</p>
                              ) : null}
                            </div>
                            {hit.is_active === false ? (
                              <span className="text-xs text-muted-foreground">Inactif</span>
                            ) : null}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    );
                  })
                : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
