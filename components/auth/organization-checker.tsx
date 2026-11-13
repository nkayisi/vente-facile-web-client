"use client";

import { createContext, useContext, useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { acquitterSuspension, getUserOrganizations, Organization } from "@/actions/organization.actions";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { reportClientError } from "@/lib/observability/report-error";
import { Ban, Loader2, WifiOff } from "lucide-react";
import { PHRASE_SUSPENDU } from "@/lib/auth/codes-connexion";
import { organisationDuSignal } from "@/lib/auth/signal-suspension";

interface OrganizationContextValue {
  organization: Organization | null;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  refreshOrganization: async () => { },
});

export function useOrganization() {
  return useContext(OrganizationContext);
}

/**
 * Le premier établissement OUVERT de la liste, ou `null`.
 *
 * ⚠ Le serveur garde les établissements suspendus dans la liste, avec leur
 * `is_active` : c'est ce qui permet d'ouvrir un établissement actif quand un
 * compte en a plusieurs, et de dire « suspendu » quand il n'en reste aucun.
 * Prendre le premier sans regarder ouvrait une boutique dont chaque écran
 * répondrait « suspendu ».
 */
function premiereOuverte(organisations: Organization[]): Organization | null {
  return organisations.find(estOuverte) ?? null;
}

/** `is_active` absent vaut ouvert : seul un `false` explicite ferme. */
function estOuverte(o: Organization): boolean {
  return o.is_active !== false;
}

const BOUTON_PRIMAIRE =
  "inline-flex h-10 items-center justify-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700";
const BOUTON_SECONDAIRE =
  "inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50";

interface EcranSuspensionProps {
  /** L'établissement suspendu sous les yeux de l'utilisateur, s'il y en a un. */
  nom: string | null;
  /** Les établissements du compte encore ouverts, qu'on peut ouvrir à la place. */
  alternatives: Organization[];
  onChoisir: (organisation: Organization) => void;
  onVerifier: () => void;
  enVerification: boolean;
}

/**
 * L'écran d'un établissement suspendu par Vente Facile, UN SEUL pour les deux cas :
 * au chargement quand tout est suspendu, et en cours de session quand
 * l'établissement ouvert l'est. Deux écrans pour le même fait finiraient par
 * dire deux choses différentes.
 *
 * ⚠ Les autres établissements se CHOISISSENT, ils ne s'ouvrent pas d'eux-mêmes
 * (décision du 2026-11-13) : basculer en silence ferait travailler le caissier
 * dans une autre boutique sans qu'il l'ait voulu.
 */
function EcranSuspension({ nom, alternatives, onChoisir, onVerifier, enVerification }: EcranSuspensionProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <Ban className="h-7 w-7 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Établissement suspendu</h2>
        {nom && <p className="text-sm font-medium text-gray-900 mb-2">{nom}</p>}
        <p className="text-sm text-gray-500 mb-6">{PHRASE_SUSPENDU}</p>
        {alternatives.length > 0 && (
          <div className="mb-6 text-left">
            <p className="mb-2 text-sm text-gray-700">
              {alternatives.length > 1
                ? "Vos autres établissements restent ouverts :"
                : "Votre autre établissement reste ouvert :"}
            </p>
            <div className="flex flex-col gap-2">
              {alternatives.map((o) => (
                <button key={o.id} onClick={() => onChoisir(o)} className={BOUTON_PRIMAIRE}>
                  Ouvrir {o.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onVerifier}
            disabled={enVerification}
            className={`${BOUTON_SECONDAIRE} disabled:opacity-60`}
          >
            {enVerification && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vérifier à nouveau
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            // Sans autre établissement, se déconnecter est la seule issue : elle prend le premier plan.
            className={alternatives.length > 0 ? BOUTON_SECONDAIRE : BOUTON_PRIMAIRE}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrganizationCheckerProps {
  children: React.ReactNode;
  /**
   * Le signal posé par `serverAxios` au premier refus « établissement
   * suspendu » (`lib/auth/suspension.ts`), lu par le layout serveur. `null`
   * quand rien n'est signalé.
   */
  signalSuspension?: string | null;
}

export function OrganizationChecker({ children, signalSuspension = null }: OrganizationCheckerProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isChecking, setIsChecking] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  /** Le compte n'a plus que des établissements suspendus par Vente Facile. */
  const [toutSuspendu, setToutSuspendu] = useState(false);
  /** L'établissement OUVERT a été suspendu en cours de session. */
  const [suspendue, setSuspendue] = useState<Organization | null>(null);
  /** Les établissements encore ouverts, proposés sur l'écran de suspension. */
  const [alternatives, setAlternatives] = useState<Organization[]>([]);
  const [enVerification, setEnVerification] = useState(false);
  /** Le dernier signal traité : un signal ne se traite qu'une fois. */
  const signalTraiteRef = useRef<string | null>(null);
  /** Erreur de chargement des organisations (réseau / backend). Affichée avec un bouton « Réessayer » plutôt qu'une page blanche. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Incrémenté pour forcer un nouveau chargement (bouton Réessayer). */
  const [reloadNonce, setReloadNonce] = useState(0);
  /** Dernier accessToken pour lequel le chargement des orgs est terminé (permet refetch après refresh JWT). */
  const lastLoadedTokenRef = useRef<string | null>(null);
  const orgFetchInFlightRef = useRef(false);
  const accessTokenRef = useRef<string | undefined>(undefined);

  const accessToken = session?.accessToken;
  accessTokenRef.current = accessToken;

  const loadOrganization = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await getUserOrganizations(accessToken);

      // Si l'utilisateur n'existe pas, déconnecter automatiquement
      if (!result.success && result.errorCode === 'user_not_found') {
        console.warn("User not found, signing out...");
        await signOut({ callbackUrl: '/auth/login' });
        return;
      }

      if (result.success && result.data && result.data.length > 0) {
        const ouverte = premiereOuverte(result.data);
        setOrganization(ouverte);
        setToutSuspendu(ouverte === null);
      }
    } catch (error) {
      console.error("Error refreshing organization:", error);
    }
  }, [accessToken]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated") {
      lastLoadedTokenRef.current = null;
      router.push("/auth/login");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    // Authentifié mais pas encore de jeton dans la session client : ne pas bloquer indéfiniment
    if (!accessToken) {
      setIsChecking(false);
      return;
    }

    // Même jeton déjà chargé : pas de refetch (nouveau jeton après refresh → refetch)
    if (lastLoadedTokenRef.current === accessToken) {
      setIsChecking(false);
      return;
    }

    if (orgFetchInFlightRef.current) {
      return;
    }

    const tokenForThisFetch = accessToken;
    orgFetchInFlightRef.current = true;
    setIsChecking(true);
    setLoadError(null);

    (async () => {
      let fetchSucceeded = false;
      try {
        const result = await getUserOrganizations(tokenForThisFetch);

        if (accessTokenRef.current !== tokenForThisFetch) {
          return;
        }

        if (!result.success && result.errorCode === 'user_not_found') {
          console.warn("User not found, signing out...");
          lastLoadedTokenRef.current = null;
          await signOut({ callbackUrl: '/auth/login' });
          return;
        }

        if (result.success && result.data) {
          fetchSucceeded = true;
          if (result.data.length === 0) {
            // Aucune organisation : on redirige vers l'inscription.
            router.push("/auth/register");
          } else {
            const ouverte = premiereOuverte(result.data);
            setOrganization(ouverte);
            setToutSuspendu(ouverte === null);
          }
        } else {
          // Échec backend (401 après retry, 5xx, etc.). NE PAS renvoyer une page
          // blanche : afficher une erreur récupérable. On conserve l'org déjà
          // chargée si on en avait une (refetch échoué après refresh JWT).
          reportClientError(new Error("Échec du chargement des organisations"), {
            boundary: "organization-checker",
            errorCode: result.errorCode,
          });
          setLoadError(
            "Impossible de charger votre espace de travail. Vérifiez votre connexion et réessayez."
          );
        }
      } catch (error) {
        reportClientError(error, { boundary: "organization-checker" });
        if (accessTokenRef.current === tokenForThisFetch) {
          setLoadError(
            "Impossible de charger votre espace de travail. Vérifiez votre connexion et réessayez."
          );
        }
      } finally {
        if (accessTokenRef.current === tokenForThisFetch) {
          // On ne marque le token comme « chargé » que si le fetch a réussi,
          // pour qu'un simple Réessayer relance réellement l'appel.
          if (fetchSucceeded) {
            lastLoadedTokenRef.current = tokenForThisFetch;
          }
          setIsChecking(false);
        }
        orgFetchInFlightRef.current = false;
      }
    })();

    return () => {
      orgFetchInFlightRef.current = false;
    };
  }, [status, accessToken, router, session?.error, reloadNonce]);

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ LE PREMIER REFUS « SUSPENDU » REMPLACE TOUT LE TABLEAU DE BORD.      │
  // │                                                                      │
  // │ Le signal arrive du layout serveur, re-rendu par Next dans le même   │
  // │ aller-retour que la server action refusée. Il ne se traite qu'UNE    │
  // │ fois, puis s'acquitte : le cookie n'est qu'un transport. On RELIT la │
  // │ liste avant de conclure : le signal dit qu'un refus a eu lieu, la    │
  // │ liste dit si l'établissement est encore suspendu à cet instant.      │
  // └──────────────────────────────────────────────────────────────────────┘
  useEffect(() => {
    if (!signalSuspension || signalSuspension === signalTraiteRef.current) return;
    signalTraiteRef.current = signalSuspension;
    void acquitterSuspension();

    const visee = organisationDuSignal(signalSuspension);
    // Seul l'établissement OUVERT compte : un refus venu d'un autre (un
    // onglet resté sur une ancienne boutique) ne ferme pas celui-ci.
    if (!accessToken || !organization || visee !== organization.id) return;

    let annule = false;
    (async () => {
      const result = await getUserOrganizations(accessToken);
      if (annule || !result.success || !result.data) return;
      const elle = result.data.find((o) => o.id === visee);
      if (!elle || estOuverte(elle)) return; // Réactivé entre-temps : rien à montrer.
      setSuspendue(elle);
      setAlternatives(result.data.filter(estOuverte));
      setOrganization(null);
    })();
    return () => {
      annule = true;
    };
  }, [signalSuspension, accessToken, organization]);

  /**
   * « Vérifier à nouveau » sur l'écran d'une suspension en cours de session.
   *
   * ⚠ Distinct de `retry`, qui repartirait de la règle du chargement
   * (`premiereOuverte`) : réactivé, c'est l'établissement SUSPENDU qu'on
   * rouvre, pas le premier de la liste.
   */
  const verifierSuspendue = useCallback(async () => {
    if (!accessToken || !suspendue) return;
    setEnVerification(true);
    try {
      const result = await getUserOrganizations(accessToken);
      if (!result.success || !result.data) return;
      const elle = result.data.find((o) => o.id === suspendue.id);
      setAlternatives(result.data.filter(estOuverte));
      if (elle && estOuverte(elle)) {
        setOrganization(elle);
        setSuspendue(null);
      } else if (!elle) {
        // Plus membre de cet établissement : la règle du chargement reprend.
        const ouverte = premiereOuverte(result.data);
        setSuspendue(null);
        setOrganization(ouverte);
        setToutSuspendu(ouverte === null);
      }
    } finally {
      setEnVerification(false);
    }
  }, [accessToken, suspendue]);

  const choisir = useCallback((autre: Organization) => {
    setOrganization(autre);
    setSuspendue(null);
    setToutSuspendu(false);
  }, []);

  const retry = useCallback(() => {
    lastLoadedTokenRef.current = null;
    orgFetchInFlightRef.current = false;
    setLoadError(null);
    setIsChecking(true);
    setReloadNonce((n) => n + 1);
  }, []);

  const contextValue = useMemo(() => ({
    organization,
    refreshOrganization: loadOrganization,
  }), [organization, loadOrganization]);

  // Loader plein écran UNIQUEMENT tant qu'aucune organisation n'a encore été
  // chargée. Une fois l'espace de travail monté, un état transitoire
  // (`status === "loading"` pendant un refetch de session déclenché par
  // `update()`, ou `isChecking` pendant un refetch d'orgs après rotation du
  // JWT) ne doit PLUS démonter l'arbre : chaque démontage relançait le fetch
  // des permissions, de l'abonnement et du profil, réarmait le refresh
  // proactif de SessionMonitor et repartait en boucle - d'où le « chargement
  // infini » visible dans les logs.
  if (suspendue) {
    return (
      <EcranSuspension
        nom={suspendue.name}
        alternatives={alternatives}
        onChoisir={choisir}
        onVerifier={() => void verifierSuspendue()}
        enVerification={enVerification}
      />
    );
  }

  if (toutSuspendu && !organization && !isChecking) {
    return (
      <EcranSuspension
        nom={null}
        alternatives={[]}
        onChoisir={choisir}
        onVerifier={retry}
        enVerification={false}
      />
    );
  }

  if (!organization && (status === "loading" || isChecking)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Erreur de chargement sans org disponible : écran récupérable, JAMAIS de page
  // blanche. Si une org est déjà chargée (refetch échoué), on laisse l'app tourner.
  if (loadError && !organization) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <WifiOff className="h-7 w-7 text-orange-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Connexion à votre espace impossible
          </h2>
          <p className="text-sm text-gray-500 mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={retry}
              className="inline-flex h-10 items-center justify-center rounded-md bg-orange-600 px-4 text-sm font-medium text-white hover:bg-orange-700"
            >
              Réessayer
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Se reconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pas d'org et pas d'erreur : une redirection (register / login) est en cours.
  // On affiche un loader plutôt qu'un écran vide, le temps que la navigation opère.
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <OrganizationContext.Provider value={contextValue}>
      <CurrencyProvider currencyInfo={organization?.default_currency_info}>
        {children}
      </CurrencyProvider>
    </OrganizationContext.Provider>
  );
}
