import { useState, useCallback } from "react";

export interface PaginationInfo {
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}

export interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  setPaginationInfo: (info: Partial<PaginationInfo>) => void;
}

export function usePagination(initialPageSize: number = 20): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const totalPages = Math.ceil(totalCount / pageSize);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNext) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNext]);

  const previousPage = useCallback(() => {
    if (hasPrevious) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPrevious]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  const setPaginationInfo = useCallback((info: Partial<PaginationInfo>) => {
    if (info.count !== undefined) {
      setTotalCount(info.count);
    }
    if (info.next !== undefined) {
      setHasNext(info.next !== null);
    }
    if (info.previous !== undefined) {
      setHasPrevious(info.previous !== null);
    }
  }, []);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalCount,
    hasNext,
    hasPrevious,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    setPaginationInfo,
  };
}
