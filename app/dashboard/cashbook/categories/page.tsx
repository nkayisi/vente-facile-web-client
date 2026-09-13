"use client";

/**
 * Rubriques de caisse : types d'entrée et catégories de dépense.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CETTE PAGE N'EXISTAIT PAS, ET SES ACTIONS DORMAIENT DEPUIS TOUJOURS.    │
 * │                                                                          │
 * │ `updateIncomeCategory` et `updateExpenseCategory` étaient écrites, sans  │
 * │ le moindre appelant : une rubrique mal orthographiée restait fausse pour │
 * │ toujours, sur tous les écrans et dans tous les rapports. Et il n'y avait │
 * │ AUCUNE gestion des types d'entrée - seulement le mini-champ en ligne du  │
 * │ dialogue « Nouvelle entrée », qui ne sait que créer, et qu'un nom.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ ON DÉSACTIVE, ON NE SUPPRIME PAS.                                       │
 * │                                                                          │
 * │ `ExpenseCategory` est `PROTECT`-référencée par `Expense` : supprimer une │
 * │ rubrique employée lève `ProtectedError`, donc un 500 - et toute rubrique │
 * │ qui vaut la peine d'être gérée est employée. `IncomeCategory` est        │
 * │ `SET_NULL` et orphelinerait l'historique EN SILENCE. Enfin, aucune des   │
 * │ deux tables n'émet de pierre tombale au tirage : une suppression ici     │
 * │ n'atteindrait jamais un terminal, où la rubrique resterait proposée à la │
 * │ saisie, pour toujours. `is_active` fait ce qu'on attend sans les dégâts. │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Plus, Search, Tag } from "lucide-react";
import { toast } from "sonner";

import {
  getIncomeCategories,
  createIncomeCategory,
  updateIncomeCategory,
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  IncomeCategory,
  ExpenseCategory,
} from "@/actions/cashbook.actions";
import { useOrganization } from "@/components/auth/organization-checker";
import { usePermissions } from "@/components/auth/permissions-provider";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Les deux familles se gèrent pareil : une seule page, deux onglets. */
type Genre = "expense" | "income";

/** Ce qu'un formulaire porte, quelle que soit la famille. */
interface Formulaire {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  budget_monthly: string;
}

const COULEUR_DEFAUT: Record<Genre, string> = {
  income: "#10B981",
  expense: "#6B7280",
};

function vide(genre: Genre): Formulaire {
  return {
    name: "",
    description: "",
    color: COULEUR_DEFAUT[genre],
    is_active: true,
    budget_monthly: "",
  };
}

/** Une rubrique, quelle que soit sa famille. */
type Rubrique = (IncomeCategory | ExpenseCategory) & {
  budget_monthly?: string;
  movement_count?: number;
  expense_count?: number;
};

export default function CashbookCategoriesPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { hasPermission } = usePermissions();
  // ⚠ Le jeton est extrait AVANT les rappels : lire `session?.accessToken`
  // dans un corps mémoïsé y fait entrer `session` entier.
  const jeton = session?.accessToken;
  const orgId = organization?.id;
  const peutGerer = hasPermission("cashbook.manage_categories");

  const [genre, setGenre] = useState<Genre>("expense");
  const [depenses, setDepenses] = useState<ExpenseCategory[]>([]);
  const [entrees, setEntrees] = useState<IncomeCategory[]>([]);
  const [recherche, setRecherche] = useState("");

  /**
   * ⚠ DEUX ÉTATS DE CHARGEMENT, ET IL EN FAUT DEUX.
   *
   * Un `isLoading` remis à vrai à chaque requête remplace la carte par un
   * squelette à chaque frappe : le champ de recherche se démonte et PERD LE
   * FOCUS, si bien qu'on ne peut pas taper deux caractères. C'est le défaut que
   * « Historique des ventes » puis les deux pages de caisse ont dû corriger.
   */
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dialogue, setDialogue] = useState<{ cible: Rubrique | null } | null>(null);
  const [form, setForm] = useState<Formulaire>(vide("expense"));

  const charger = useCallback(async () => {
    if (!jeton || !orgId) return;
    setIsFetching(true);
    try {
      const [d, e] = await Promise.all([
        getExpenseCategories(jeton, orgId),
        getIncomeCategories(jeton, orgId),
      ]);
      if (d.success && d.data) setDepenses(d.data.results ?? []);
      if (e.success && e.data) setEntrees(e.data.results ?? []);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [jeton, orgId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const rubriques: Rubrique[] = useMemo(() => {
    const source: Rubrique[] = genre === "expense" ? depenses : entrees;
    const terme = recherche.trim().toLowerCase();
    if (!terme) return source;
    return source.filter(
      (r) =>
        r.name.toLowerCase().includes(terme) ||
        (r.description ?? "").toLowerCase().includes(terme)
    );
  }, [genre, depenses, entrees, recherche]);

  const ouvrir = (cible: Rubrique | null) => {
    setForm(
      cible
        ? {
            name: cible.name,
            description: cible.description ?? "",
            color: cible.color || COULEUR_DEFAUT[genre],
            is_active: cible.is_active,
            budget_monthly: (cible as ExpenseCategory).budget_monthly ?? "",
          }
        : vide(genre)
    );
    setDialogue({ cible });
  };

  const enregistrer = async () => {
    if (!jeton || !orgId || !dialogue) return;
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setIsSubmitting(true);
    try {
      const commun = {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        is_active: form.is_active,
      };
      const cible = dialogue.cible;
      const res = cible
        ? genre === "expense"
          ? await updateExpenseCategory(jeton, orgId, cible.id, {
              ...commun,
              ...(form.budget_monthly ? { budget_monthly: form.budget_monthly } : {}),
            })
          : await updateIncomeCategory(jeton, orgId, cible.id, commun)
        : genre === "expense"
          ? await createExpenseCategory(jeton, orgId, {
              ...commun,
              ...(form.budget_monthly ? { budget_monthly: form.budget_monthly } : {}),
            })
          : await createIncomeCategory(jeton, orgId, commun);

      if (!res.success) {
        // Le serveur oppose l'unicité du nom en `__iexact` : son message est
        // plus précis que tout ce qu'on pourrait deviner ici.
        toast.error(res.error || "Enregistrement impossible");
        return;
      }
      toast.success(cible ? "Rubrique mise à jour" : "Rubrique créée");
      setDialogue(null);
      await charger();
    } finally {
      setIsSubmitting(false);
    }
  };

  const singulier = genre === "expense" ? "catégorie de dépense" : "type d'entrée";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/cashbook/expenses">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Rubriques de caisse</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Types d&apos;entrée et catégories de dépense
            </p>
          </div>
        </div>
        {peutGerer ? (
          <Button
            size="sm"
            className="w-full md:w-auto"
            onClick={() => ouvrir(null)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle rubrique
          </Button>
        ) : null}
      </div>

      <Tabs
        value={genre}
        onValueChange={(v) => {
          setGenre(v as Genre);
          setRecherche("");
        }}
      >
        <TabsList>
          <TabsTrigger value="expense">Catégories de dépense</TabsTrigger>
          <TabsTrigger value="income">Types d&apos;entrée</TabsTrigger>
        </TabsList>

        <TabsContent value={genre} className="mt-4">
          <Card>
            <CardHeader className="gap-4">
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                {`${rubriques.length} ${rubriques.length > 1 ? "rubriques" : "rubrique"}`}
                {isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </CardTitle>
              <div className="relative w-full sm:w-[280px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Rechercher..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rubriques.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {recherche.trim()
                    ? `Aucun ${singulier} ne correspond à « ${recherche.trim()} ».`
                    : `Aucun ${singulier} pour l'instant.`}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead className="text-right">
                        {genre === "expense" ? "Dépenses" : "Mouvements"}
                      </TableHead>
                      <TableHead>État</TableHead>
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rubriques.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: r.color || COULEUR_DEFAUT[genre] }}
                            />
                            {r.name}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {r.description || "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {/* Ce nombre dit si la rubrique SERT : c'est lui qui
                              explique pourquoi on la désactive au lieu de la
                              supprimer. */}
                          {genre === "expense"
                            ? (r.expense_count ?? 0)
                            : (r.movement_count ?? 0)}
                        </TableCell>
                        <TableCell>
                          {r.is_active ? (
                            <Badge variant="outline">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {peutGerer ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Modifier ${r.name}`}
                              onClick={() => ouvrir(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogue !== null} onOpenChange={(o) => !o && setDialogue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogue?.cible ? `Modifier ${dialogue.cible.name}` : `Nouveau ${singulier}`}
            </DialogTitle>
            <DialogDescription>
              {genre === "expense"
                ? "Elle classe les charges dans les listes et les rapports."
                : "Il classe les entrées de caisse dans les listes et les rapports."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rubrique-nom">Nom *</Label>
              <Input
                id="rubrique-nom"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={
                  genre === "expense" ? "Ex: Loyer, Transport…" : "Ex: Apport, Subvention…"
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubrique-description">Description</Label>
              <Input
                id="rubrique-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description optionnelle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rubrique-couleur">Couleur</Label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="rubrique-couleur"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded border"
                />
                <span className="text-sm text-muted-foreground">{form.color}</span>
              </div>
            </div>
            {genre === "expense" ? (
              <div className="space-y-2">
                <Label htmlFor="rubrique-budget">Budget mensuel</Label>
                <Input
                  id="rubrique-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget_monthly}
                  onChange={(e) => setForm({ ...form, budget_monthly: e.target.value })}
                  placeholder="0"
                />
                {/* Le serveur le porte depuis toujours et aucun écran ne
                    l'exposait. Il est en devise PRINCIPALE, comme
                    `total_spent` auquel il se compare. */}
                <p className="text-xs text-muted-foreground">
                  Optionnel, en devise principale.
                </p>
              </div>
            ) : null}
            {/* L'interrupteur n'apparaît QU'EN MODIFICATION : une rubrique
                qu'on vient de créer n'a pas à naître désactivée. */}
            {dialogue?.cible ? (
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-1">
                  <Label htmlFor="rubrique-active">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    {form.is_active
                      ? "Elle est proposée à la saisie."
                      : "Elle disparaît des formulaires. L'historique la garde, et les rapports aussi."}
                  </p>
                </div>
                <Switch
                  id="rubrique-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogue(null)}>
              Annuler
            </Button>
            <Button onClick={enregistrer} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {dialogue?.cible ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
