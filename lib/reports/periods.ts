/**
 * Les fenêtres que `/reports/statistics/*` accepte, et leurs libellés.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UNE SEULE LISTE, PARCE QU'UNE SECONDE DÉRIVERAIT.                       │
 * │                                                                          │
 * │ Elle vivait dans `app/dashboard/reports/page.tsx`, locale à cette page.  │
 * │ Une rubrique qui en offrirait d'autres proposerait des fenêtres que le   │
 * │ serveur ne connaît pas - et `_parse_date_range` retombe alors sur son    │
 * │ défaut SANS rien dire, ce qui a déjà fait annoncer « aucune donnée » sur │
 * │ un établissement qui venait de vendre.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LES TROIS PREMIÈRES SONT GLISSANTES, les suivantes CALENDAIRES, et c'est
 * délibéré : « Ce mois » doit suivre le calendrier, mais l'imposer à qui ne
 * demande rien faisait couvrir DEUX JOURS le 2 du mois. Le défaut du serveur
 * est donc `last_30_days`.
 */
export const PERIOD_OPTIONS = [
  { value: "last_7_days", label: "7 derniers jours" },
  { value: "last_30_days", label: "30 derniers jours" },
  { value: "last_12_months", label: "12 derniers mois" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Ce trimestre" },
  { value: "year", label: "Cette année" },
  { value: "custom", label: "Personnalisé" },
] as const;

/**
 * Les valeurs, en type.
 *
 * Dérivé de la liste et non recopié : un libellé ajouté sans sa valeur, ou
 * l'inverse, ne compilerait pas - alors qu'une union écrite à la main dériverait
 * en silence, et `_parse_date_range` retombe sur son défaut SANS rien dire.
 */
export type PeriodOption = (typeof PERIOD_OPTIONS)[number]["value"];

/**
 * Les fenêtres NOMMÉES, sans `custom`.
 *
 * ⚠ `custom` n'est pas un mot clé de période : c'est un MODE d'écran, qui dit
 * « lis `date_from` et `date_to` ». L'envoyer au serveur comme `period=custom`
 * ne désignerait aucune fenêtre, et `_parse_date_range` retomberait sur son
 * défaut sans rien dire. `ReportFilters.period` l'exclut déjà, à raison.
 */
export type PeriodKeyword = Exclude<PeriodOption, "custom">;

/** Les options qu'un sélecteur sans saisie de dates peut offrir. */
export const PERIOD_KEYWORDS = PERIOD_OPTIONS.filter(
  (o): o is (typeof PERIOD_OPTIONS)[number] & { value: PeriodKeyword } =>
    o.value !== "custom"
);

/** Le défaut du serveur, et celui des écrans : une fenêtre glissante. */
export const PERIOD_DEFAULT: PeriodKeyword = "last_30_days";

export function periodLabel(value: string): string {
  return PERIOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
