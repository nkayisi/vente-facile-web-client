"use client";

/**
 * La porte de mise à jour du terminal mobile.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CETTE PAGE PEUT BLOQUER TOUT LE PARC, ET ELLE SEULE PEUT LE DÉBLOQUER.   │
 * │                                                                          │
 * │ Un seuil posé au-dessus de ce que le magasin sert rend chaque terminal   │
 * │ inutilisable sans qu'aucun ne puisse s'y conformer, et la réparation ne  │
 * │ peut venir que d'ici. Les trois règles sont donc ÉCRITES au-dessus du    │
 * │ formulaire, pas seulement opposées après coup dans un message d'erreur.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ **UN CHARGEMENT QUI ÉCHOUE NE REND AUCUN FORMULAIRE.** Huit champs blancs
 * sont indiscernables d'un singleton jamais configuré : l'administrateur y
 * saisissait son seuil, pressait Enregistrer, et les huit champs partaient -
 * dont la version de magasin, qui est la seule chose empêchant de briquer le
 * parc. On n'offre jamais à modifier ce qu'on n'a pas su lire.
 *
 * ⚠ **L'ENVOI NE PORTE QUE CE QUI A CHANGÉ.** `AdminAppReleaseView` écrit
 * elle-même qu'« un `PUT` exigerait les huit champs et ferait effacer une
 * plateforme en voulant régler l'autre » : cette page se comportait exactement
 * comme un `PUT`. Le sérialiseur est `partial=True` et confronte l'envoi à
 * l'instance enregistrée, donc un envoi différentiel est non seulement correct,
 * il rend la perte structurellement impossible.
 */

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, RotateCcw, Save, Smartphone } from "lucide-react";

import { getAppRelease, updateAppRelease, AppRelease } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/** Les huit champs, dans l'ordre. Une seule liste : deux finiraient par diverger. */
const CHAMPS = [
  "android_minimum_version",
  "android_current_version",
  "android_store_url",
  "android_update_message",
  "ios_minimum_version",
  "ios_current_version",
  "ios_store_url",
  "ios_update_message",
] as const satisfies readonly (keyof AppRelease)[];

const VIDE: AppRelease = {
  android_minimum_version: "",
  android_current_version: "",
  android_store_url: "",
  android_update_message: "",
  ios_minimum_version: "",
  ios_current_version: "",
  ios_store_url: "",
  ios_update_message: "",
};

const ECHEC_LECTURE =
  "La configuration n'a pas pu être lue. Rien n'a été modifié.";

/**
 * Ce que l'administrateur a réellement changé, mesuré contre la valeur CHARGÉE.
 *
 * ⚠ C'est ce qui rend la perte impossible plutôt qu'improbable : un champ
 * qu'on n'a pas touché ne voyage pas, donc il ne peut pas être écrasé - ni par
 * une valeur vide, ni par une valeur périmée.
 */
function diffAppRelease(
  reference: AppRelease,
  valeurs: AppRelease
): Partial<AppRelease> {
  return CHAMPS.reduce<Partial<AppRelease>>((acc, champ) => {
    if (valeurs[champ] !== reference[champ]) acc[champ] = valeurs[champ];
    return acc;
  }, {});
}

type Plateforme = "android" | "ios";

const PLATEFORMES: Record<Plateforme, { titre: string; aideUrl: string; note: string }> = {
  android: {
    titre: "Android",
    aideUrl:
      "Une fiche Play (play.google.com/store/apps/details?id=...) ouvre directement l'application du magasin. Toute autre adresse est servie telle quelle : revendeur, galerie tierce, ou lien d'APK direct.",
    note: "Les terminaux de comptoir n'ont pas tous le Play Store. Pour ceux-là, une adresse d'APK direct ou un message suffit.",
  },
  ios: {
    titre: "iOS",
    aideUrl: "Adresse de la fiche App Store.",
    note: "iOS n'autorise aucune installation manuelle : laissez le seuil vide tant que l'application n'est pas publiée, sinon un terminal bloqué n'a aucune issue.",
  },
};

/** Le message d'erreur du serveur pour un champ, ou `null`. */
function erreurDe(erreurs: Record<string, unknown> | null, champ: string): string | null {
  const valeur = erreurs?.[champ];
  if (Array.isArray(valeur)) return String(valeur[0] ?? "");
  if (typeof valeur === "string") return valeur;
  return null;
}

export default function AdminApplicationPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;

  /** La valeur CHARGÉE. `null` tant qu'on ne l'a pas lue : rien à comparer. */
  const [reference, setReference] = useState<AppRelease | null>(null);
  const [valeurs, setValeurs] = useState<AppRelease>(VIDE);
  const [chargement, setChargement] = useState(true);
  const [echec, setEchec] = useState<string | null>(null);
  const [tentative, setTentative] = useState(0);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, unknown> | null>(null);

  // ⚠ AUCUN `setChargement(true)` SYNCHRONE ICI. L'état part déjà à `true` :
  // le poser dans le corps de l'effet déclenche un rendu en cascade, que le
  // lint refuse à raison. Les écritures qui restent sont toutes derrière un
  // `await`. C'est `tentative` qui relance la lecture, pas un appel direct :
  // ainsi la garde `vivant` couvre aussi les reprises.
  useEffect(() => {
    if (!jeton) return;
    let vivant = true;
    void (async () => {
      const res = await getAppRelease(jeton);
      if (!vivant) return;
      if (res.success && res.data) {
        setReference(res.data);
        setValeurs(res.data);
        setEchec(null);
      } else {
        // On NOMME l'échec à l'écran, et surtout on ne rend pas le formulaire :
        // un toast de quatre secondes disparaît, un formulaire vide reste.
        setEchec(res.message ?? ECHEC_LECTURE);
      }
      setChargement(false);
    })();
    return () => {
      vivant = false;
    };
  }, [jeton, tentative]);

  const modifications = useMemo(
    () => (reference ? diffAppRelease(reference, valeurs) : {}),
    [reference, valeurs]
  );
  const nbModifications = Object.keys(modifications).length;

  const reessayer = () => {
    setChargement(true);
    setEchec(null);
    setTentative((n) => n + 1);
  };

  const enregistrer = async () => {
    if (!jeton || !reference) return;
    if (nbModifications === 0) {
      toast.info("Aucune modification à enregistrer");
      return;
    }
    setEnregistrement(true);
    setErreurs(null);
    const res = await updateAppRelease(jeton, modifications);
    if (res.success && res.data) {
      // La référence se recale : ce qui vient d'être enregistré n'est plus une
      // modification, sinon le prochain envoi le renverrait.
      setReference(res.data);
      setValeurs(res.data);
      toast.success("Porte de mise à jour enregistrée");
    } else {
      // Les erreurs par champ restent affichées SOUS le champ : les aplatir en
      // un toast ferait chercher lequel des huit est en cause.
      setErreurs(res.errors ?? null);
      toast.error(res.message ?? "Enregistrement impossible");
    }
    setEnregistrement(false);
  };

  /**
   * ⚠ **TOUTES les erreurs partent, pas seulement celle du champ édité.**
   *
   * Les huit champs sont validés ENSEMBLE : la règle anti-brique en couple deux
   * (seuil et version du magasin), la règle « mène quelque part » en couple
   * trois. Garder l'une d'elles après une modification afficherait un verdict
   * portant sur un état qui n'existe plus - et le champ nommé n'est pas
   * toujours celui qu'on vient de corriger.
   */
  const poser = (champ: keyof AppRelease, valeur: string) => {
    setValeurs((v) => ({ ...v, [champ]: valeur }));
    setErreurs(null);
  };

  const bloc = (p: Plateforme) => {
    const meta = PLATEFORMES[p];
    const champs = {
      minimum: `${p}_minimum_version` as keyof AppRelease,
      courante: `${p}_current_version` as keyof AppRelease,
      url: `${p}_store_url` as keyof AppRelease,
      message: `${p}_update_message` as keyof AppRelease,
    };

    return (
      <Card key={p}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            {meta.titre}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{meta.note}</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={champs.minimum}>Version minimale exigée</Label>
              <Input
                id={champs.minimum}
                placeholder="1.3.0"
                value={valeurs[champs.minimum]}
                onChange={(e) => poser(champs.minimum, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Vide = aucune exigence. En dessous, le terminal est bloqué.
              </p>
              {erreurDe(erreurs, champs.minimum) ? (
                <p className="text-xs text-destructive">{erreurDe(erreurs, champs.minimum)}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={champs.courante}>
                Version servie par le magasin{" "}
                {valeurs[champs.minimum] ? (
                  <span className="text-destructive">*</span>
                ) : null}
              </Label>
              <Input
                id={champs.courante}
                placeholder="1.3.0"
                value={valeurs[champs.courante]}
                onChange={(e) => poser(champs.courante, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Obligatoire dès qu&apos;un seuil est posé : c&apos;est elle qui interdit
                d&apos;exiger une version qu&apos;aucun terminal ne peut installer. Elle est
                aussi nommée au marchand, pour qu&apos;il sache quoi réclamer.
              </p>
              {erreurDe(erreurs, champs.courante) ? (
                <p className="text-xs text-destructive">{erreurDe(erreurs, champs.courante)}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={champs.url}>Adresse de mise à jour</Label>
            <Input
              id={champs.url}
              placeholder="https://..."
              value={valeurs[champs.url]}
              onChange={(e) => poser(champs.url, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{meta.aideUrl}</p>
            {erreurDe(erreurs, champs.url) ? (
              <p className="text-xs text-destructive">{erreurDe(erreurs, champs.url)}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={champs.message}>Message affiché au marchand</Label>
            <Textarea
              id={champs.message}
              rows={2}
              placeholder="Appelez le 09XXXXXXXX pour recevoir la nouvelle version."
              value={valeurs[champs.message]}
              onChange={(e) => poser(champs.message, e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Remplace le texte par défaut. C&apos;est la seule issue d&apos;un terminal
              sans magasin.
            </p>
            {erreurDe(erreurs, champs.message) ? (
              <p className="text-xs text-destructive">{erreurDe(erreurs, champs.message)}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application mobile</h1>
        <p className="text-sm text-muted-foreground">
          Forcer la mise à jour des terminaux avant qu&apos;ils puissent continuer à
          encaisser.
        </p>
      </div>

      {/*
        Les règles sont ÉCRITES, pas seulement opposées après coup : c'est
        ici qu'on vient en urgence rouvrir une porte posée trop haut, et
        quelqu'un qui découvre cet écran doit comprendre ce qu'il engage avant
        de taper un numéro.
      */}
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Trois règles avant de poser un seuil</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                <strong>Publiez d&apos;abord, posez le seuil ensuite</strong>, et nommez la
                version servie par le magasin. C&apos;est elle qui empêche d&apos;exiger une
                version qu&apos;aucun terminal ne pourrait installer : sans elle, une faute
                de frappe bloque tout le parc.
              </li>
              <li>
                <strong>Un seuil doit mener quelque part</strong> : une adresse, ou à
                défaut un message. Un terminal bloqué sans issue ne se répare que
                depuis cette page.
              </li>
              <li>
                <strong>Vider le champ rouvre la porte</strong> au prochain réveil des
                terminaux. C&apos;est la sortie d&apos;urgence.
              </li>
            </ul>
            <p className="text-muted-foreground">
              Les versions publiées avant ce mécanisme ignorent ce réglage : il n&apos;agit
              que sur les terminaux qui le portent.
            </p>
          </div>
        </CardContent>
      </Card>

      {chargement ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : echec ? (
        /*
          ⚠ AUCUN FORMULAIRE ICI, et c'est tout l'objet de cet état. Rendre les
          huit champs sur leurs valeurs par défaut les ferait passer pour la
          configuration réelle, et le premier enregistrement effacerait celle
          qui est en place - sur le seul réglage qui puisse bloquer le parc.
        */
        <Card className="border-destructive/40">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Configuration illisible</p>
                <p className="text-muted-foreground">{echec}</p>
                <p className="text-muted-foreground">
                  Le formulaire reste fermé : modifier une configuration qu&apos;on n&apos;a
                  pas su lire effacerait celle qui est en place sur les terminaux.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={reessayer}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {bloc("android")}
            {bloc("ios")}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-xs text-muted-foreground">
              {nbModifications === 0
                ? "Aucune modification."
                : nbModifications === 1
                  ? "1 champ modifié. Seul lui sera envoyé."
                  : `${nbModifications} champs modifiés. Seuls eux seront envoyés.`}
            </p>
            <Button
              onClick={() => void enregistrer()}
              disabled={enregistrement || nbModifications === 0}
            >
              {enregistrement ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
