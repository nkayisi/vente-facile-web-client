"use client";

/**
 * Remise à zéro d'un essai : effacer les OPÉRATIONS, garder la configuration.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ T8 DU RETOUR DE TEST, DEMANDÉ DEUX FOIS.                                │
 * │                                                                          │
 * │ « Supprimer les ventes et les opérations effectuées » après un essai.    │
 * │ L'annulation comptable existe et contrepasse ; la remise à zéro          │
 * │ n'existait nulle part.                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA CARTE NE PARAÎT QUE SUR UN ESSAI, et ce n'est pas qu'une économie
 * d'affichage : un bouton visible mais toujours refusé apprend à ignorer les
 * refus. Le serveur refuse de toute façon - l'écran ne fait que ne pas
 * promettre.
 *
 * ⚠ L'APERÇU PASSE AVANT LA CONFIRMATION. On montre ce qui va disparaître,
 * compté, AVANT de demander le nom : « êtes-vous sûr » sans chiffre devant les
 * yeux se presse par réflexe.
 */
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useOrganization } from "@/components/auth/organization-checker";
import { useSubscription } from "@/components/auth/subscription-guard";
import { resetTrialData, type TrialResetResult } from "@/actions/organization.actions";

/** Les libellés des modèles effacés, pour que le compte se lise. */
const LIBELLES: Record<string, string> = {
  "sales.Sale": "Ventes",
  "sales.SaleItem": "Lignes de vente",
  "sales.Payment": "Règlements",
  "sales.SaleReturn": "Retours",
  "sales.Quotation": "Devis",
  "sales.RegisterSession": "Sessions de caisse",
  "inventory.StockMovement": "Mouvements de stock",
  "inventory.Stock": "Niveaux de stock",
  "inventory.StockTransfer": "Transferts",
  "inventory.StockAdjustment": "Ajustements",
  "inventory.InventorySession": "Sessions d'inventaire",
  "cashbook.Expense": "Dépenses",
  "cashbook.CashMovement": "Mouvements de caisse",
  "contacts.CustomerTransaction": "Écritures au compte client",
  "contacts.CustomerBalance": "Soldes clients",
  "settings.LoyaltyTransaction": "Points de fidélité",
  "core.DocumentSequence": "Compteurs de documents",
  "sync.SyncOperation": "Journal de synchronisation",
};

export function TrialResetCard() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { subscriptionStatus } = useSubscription();

  const [apercu, setApercu] = useState<TrialResetResult | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const jeton = session?.accessToken;
  const orgId = organization?.id;
  const nom = organization?.name ?? "";

  // ⚠ `status === "trial"`, et non `is_active` : un abonnement ACTIF est aussi
  // actif, et c'est précisément celui qu'il ne faut pas pouvoir effacer.
  const estUnEssai = subscriptionStatus?.status === "trial";

  const compter = useCallback(async () => {
    if (!jeton || !orgId) return;
    const r = await resetTrialData(jeton, orgId, { dryRun: true });
    if (r.success && r.data) setApercu(r.data);
    // Un échec d'aperçu ne dit rien au marchand : la carte reste, sans chiffre.
    // Le serveur refusera de toute façon si l'essai a expiré entre-temps.
  }, [jeton, orgId]);

  useEffect(() => {
    // ⚠ LE SIGNALEMENT DE `set-state-in-effect` EST UN FAUX POSITIF ICI, et il
    // est mesuré : `compter` n'écrit RIEN avant son premier `await` - son seul
    // chemin synchrone est le retour anticipé sur jeton manquant. L'analyseur
    // perd la trace des `await` en traversant un bloc gardé.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- faux positif, voir ci-dessus
    if (estUnEssai) void compter();
  }, [estUnEssai, compter]);

  if (!estUnEssai) return null;

  const effacer = async () => {
    if (!jeton || !orgId) return;
    setEnvoi(true);
    const r = await resetTrialData(jeton, orgId, { confirmation: saisie });
    setEnvoi(false);

    if (!r.success) {
      // Le message du serveur PRIME : il nomme le nom à saisir, ou dit
      // pourquoi l'essai est requis.
      toast.error(r.message ?? "La remise à zéro a échoué");
      return;
    }

    const n = r.data?.total ?? 0;
    toast.success(
      `${n} enregistrement${n > 1 ? "s" : ""} effacé${n > 1 ? "s" : ""}. ` +
        "Votre catalogue et vos réglages sont intacts."
    );
    setOuvert(false);
    setSaisie("");
    void compter();
  };

  const lignes = Object.entries(apercu?.deleted ?? {})
    .map(([cle, n]) => ({ cle, label: LIBELLES[cle] ?? cle, n }))
    .filter((l) => LIBELLES[l.cle])
    .sort((a, b) => b.n - a.n);

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Remettre l&apos;essai à zéro
        </CardTitle>
        <CardDescription>
          Efface les ventes et toutes les opérations de votre période d&apos;essai.
          Votre catalogue, vos entrepôts, vos caisses, vos clients et vos réglages
          sont <span className="font-medium text-foreground">conservés</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {apercu === null ? (
          <p className="text-sm text-muted-foreground">Calcul en cours…</p>
        ) : apercu.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Il n&apos;y a aucune opération à effacer.
          </p>
        ) : (
          <>
            {/* L'APERÇU, avant la confirmation : un chiffre devant les yeux
                vaut mieux qu'un « êtes-vous sûr ». */}
            <ul className="space-y-1 text-sm">
              {lignes.slice(0, 8).map((l) => (
                <li key={l.cle} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{l.label}</span>
                  <span className="font-medium tabular-nums">{l.n}</span>
                </li>
              ))}
            </ul>
            {lignes.length > 8 && (
              <p className="text-xs text-muted-foreground">
                et {lignes.length - 8} autre{lignes.length - 8 > 1 ? "s" : ""} rubrique
                {lignes.length - 8 > 1 ? "s" : ""}.
              </p>
            )}

            <Button variant="destructive" onClick={() => setOuvert(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Remettre à zéro ({apercu.total})
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={ouvert} onOpenChange={(o) => !envoi && setOuvert(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cette action ne se défait pas</DialogTitle>
            <DialogDescription>
              {apercu?.total ?? 0} enregistrements seront effacés définitivement :
              ventes, règlements, mouvements de stock et de caisse, dettes et points
              de fidélité. Votre catalogue et vos réglages restent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirmation-essai">
              Saisissez <span className="font-medium text-foreground">{nom}</span> pour
              confirmer
            </Label>
            <Input
              id="confirmation-essai"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder={nom}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOuvert(false)} disabled={envoi}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={effacer}
              // Le bouton reste FERMÉ tant que le nom n'est pas exact : le
              // serveur refuserait, mais lui faire faire l'aller-retour pour
              // dire « non » n'apprend rien au marchand.
              disabled={envoi || saisie.trim() !== nom.trim()}
            >
              {envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Effacer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
