"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDown, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface AsyncSelectOption {
  value: string
  label: string
}

interface SearchableSelectAsyncProps {
  value: string | null | undefined
  onValueChange: (value: string) => void
  onSearch: (query: string) => Promise<AsyncSelectOption[]>
  initialOptions?: AsyncSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  debounceMs?: number
}

export function SearchableSelectAsync({
  value,
  onValueChange,
  onSearch,
  initialOptions = [],
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyMessage = "Aucun résultat.",
  className,
  disabled = false,
  debounceMs = 300,
}: SearchableSelectAsyncProps) {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<AsyncSelectOption[]>(initialOptions)
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)
  const hasLoadedInitial = React.useRef(false)

  // Mettre à jour les options initiales quand elles changent
  React.useEffect(() => {
    if (initialOptions.length > 0) {
      setOptions(prev => {
        // Fusionner : garder les options initiales + les résultats de recherche déjà chargés
        const existingValues = new Set(prev.map(o => o.value))
        const newOptions = initialOptions.filter(o => !existingValues.has(o.value))
        return newOptions.length > 0 ? [...prev, ...newOptions] : prev
      })
    }
  }, [initialOptions])

  // Charger les options initiales quand le popover s'ouvre pour la première fois
  React.useEffect(() => {
    if (open && !hasLoadedInitial.current) {
      hasLoadedInitial.current = true
      setIsSearching(true)
      onSearch("").then(results => {
        setOptions(prev => {
          const existingValues = new Set(prev.map(o => o.value))
          const newResults = results.filter(o => !existingValues.has(o.value))
          return newResults.length > 0 ? [...prev, ...newResults] : prev.length > 0 ? prev : results
        })
      }).finally(() => setIsSearching(false))
    }
  }, [open, onSearch])

  const selectedOption = options.find((option) => option.value === value)

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await onSearch(query)
        setOptions(prev => {
          // Garder l'option actuellement sélectionnée + les nouveaux résultats
          const selected = prev.find(o => o.value === value)
          const resultsMap = new Map(results.map(o => [o.value, o]))
          if (selected && !resultsMap.has(selected.value)) {
            return [selected, ...results]
          }
          return results
        })
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)
  }, [onSearch, debounceMs, value])

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selectedOption && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={handleSearch}
          />
          <CommandList>
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Recherche...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        onValueChange(option.value)
                        setOpen(false)
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
