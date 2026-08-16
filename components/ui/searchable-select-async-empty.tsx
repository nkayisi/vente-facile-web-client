"use client"

import * as React from "react"

import {
  SearchableSelectAsync,
  type AsyncSelectOption,
} from "@/components/ui/searchable-select-async"

/**
 * Wrapper de ``SearchableSelectAsync`` qui injecte une option "Aucune"
 * en tête de la liste affichée et expose ``null`` au caller quand cette
 * option est choisie (au lieu de la chaîne literal ``"none"``).
 *
 * Évite de répéter dans chaque page :
 *  - le mapping ``value === "none" ? null : value`` côté ``onValueChange`` ;
 *  - l'ajout manuel ``{value: "none", label: "Aucune ..."}`` dans ``initialOptions``.
 *
 * Usage typique :
 *
 *   <SearchableSelectAsyncWithEmpty
 *     value={formData.category}
 *     onValueChange={(value) => handleChange("category", value)}
 *     onSearch={createCategorySearchHandler(token, orgId)}
 *     emptyLabel="Aucune catégorie"
 *     placeholder="Sélectionner une catégorie"
 *     initialOption={initialCategoryOption}
 *   />
 */
const SENTINEL = "__none__"

interface SearchableSelectAsyncWithEmptyProps {
  /** Valeur courante (null/undefined = option vide sélectionnée) */
  value: string | null | undefined
  /**
   * Callback : reçoit ``null`` pour l'option vide, sinon l'id sélectionné.
   * Le second argument fournit le label associé - utile pour afficher un
   * badge "Filtre actif" sans devoir relire la liste.
   */
  onValueChange: (value: string | null, label: string | null) => void
  /** Handler de recherche serveur (voir ``lib/select-search-handlers``) */
  onSearch: (query: string) => Promise<AsyncSelectOption[]>
  /** Libellé de l'option vide (ex. "Aucune catégorie"). Défaut : "Aucun" */
  emptyLabel?: string
  /** Option à pré-charger (par ex. l'objet correspondant à ``value`` en édition) */
  initialOption?: AsyncSelectOption | null
  placeholder?: string
  searchPlaceholder?: string
  noResultsMessage?: string
  className?: string
  disabled?: boolean
  debounceMs?: number
}

export function SearchableSelectAsyncWithEmpty({
  value,
  onValueChange,
  onSearch,
  emptyLabel = "Aucun",
  initialOption,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  noResultsMessage = "Aucun résultat.",
  className,
  disabled = false,
  debounceMs = 300,
}: SearchableSelectAsyncWithEmptyProps) {
  // Décorer le handler pour préfixer l'option vide aux résultats serveur.
  const decoratedOnSearch = React.useCallback(
    async (query: string): Promise<AsyncSelectOption[]> => {
      const results = await onSearch(query)
      // L'option vide reste toujours visible, indépendamment de la recherche.
      // Ainsi l'utilisateur peut effacer sa sélection même au milieu d'une recherche.
      return [{ value: SENTINEL, label: emptyLabel }, ...results]
    },
    [onSearch, emptyLabel],
  )

  // Fusionner l'initialOption éventuelle avec l'option vide.
  const initialOptions = React.useMemo<AsyncSelectOption[]>(() => {
    const empty: AsyncSelectOption = { value: SENTINEL, label: emptyLabel }
    if (initialOption && initialOption.value !== SENTINEL) {
      return [empty, initialOption]
    }
    return [empty]
  }, [emptyLabel, initialOption])

  return (
    <SearchableSelectAsync
      value={value == null ? SENTINEL : value}
      onValueChange={(v) => {
        // Conserve la compat avec le composant base qui ne fournit que la value.
        // Le label sera transmis via ``onSelectOption`` ci-dessous.
        if (v === SENTINEL) onValueChange(null, null)
      }}
      onSelectOption={(option) => {
        if (option.value === SENTINEL) {
          onValueChange(null, null)
        } else {
          onValueChange(option.value, option.label)
        }
      }}
      onSearch={decoratedOnSearch}
      initialOptions={initialOptions}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={noResultsMessage}
      className={className}
      disabled={disabled}
      debounceMs={debounceMs}
    />
  )
}
