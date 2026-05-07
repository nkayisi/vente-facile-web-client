"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SKELETON_ROWS = 10;

const MotionTableRow = motion.create(TableRow);

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  className?: string;
  cell: (row: T, index: number) => React.ReactNode;
};

export type ProductsDataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading: boolean;
  emptyMessage: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;
  getRowKey?: (row: T, index: number) => string;
  tableFooter?: React.ReactNode;
  className?: string;
};

function defaultGetRowKey<T>(row: T, index: number): string {
  if (row && typeof row === "object" && "id" in row && (row as { id: unknown }).id != null) {
    return String((row as { id: unknown }).id);
  }
  return `row-${index}`;
}

export function ProductsDataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage,
  emptyDescription,
  emptyIcon,
  emptyAction,
  getRowKey = defaultGetRowKey,
  tableFooter,
  className,
}: ProductsDataTableProps<T>) {
  const colCount = columns.length;

  if (!isLoading && data.length === 0) {
    return (
      <Card className={cn("overflow-hidden border shadow-sm", className)}>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-14 px-6 text-center">
          {emptyIcon ? (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {emptyIcon}
            </div>
          ) : null}
          <div className="flex max-w-md flex-col gap-2">
            <p className="text-balance text-lg font-semibold text-foreground">{emptyMessage}</p>
            {emptyDescription ? (
              <p className="text-pretty text-sm text-muted-foreground">{emptyDescription}</p>
            ) : null}
          </div>
          {emptyAction ? <div className="flex flex-wrap items-center justify-center gap-2">{emptyAction}</div> : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border shadow-sm p-0", className)}>
      <CardContent className="p-0">
        <div className="relative w-full overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
              <TableRow className="border-b hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.id} className={cn("whitespace-nowrap", col.className)}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
                    <TableRow key={`sk-${rowIndex}`} className="hover:bg-transparent">
                      {columns.map((col, colIndex) => (
                        <TableCell key={col.id} className={col.className}>
                          <Skeleton
                            className={cn(
                              "h-5",
                              colIndex === 0 ? "w-[min(100%,220px)]" : colIndex === colCount - 1 ? "ml-auto w-10" : "w-[min(100%,120px)]"
                            )}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : null}
              {!isLoading ? (
                <AnimatePresence initial={false}>
                  {data.map((row, index) => (
                    <MotionTableRow
                      key={getRowKey(row, index)}
                      layout={false}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{
                        opacity: { duration: 0.18, delay: index * 0.04 },
                        y: { duration: 0.18, delay: index * 0.04 },
                      }}
                      className="border-b transition-colors duration-150 hover:bg-muted/50"
                    >
                      {columns.map((col) => (
                        <TableCell key={col.id} className={col.className}>
                          {col.cell(row, index)}
                        </TableCell>
                      ))}
                    </MotionTableRow>
                  ))}
                </AnimatePresence>
              ) : null}
            </TableBody>
          </Table>
        </div>
        {tableFooter ? <div className="border-t px-4 py-3">{tableFooter}</div> : null}
      </CardContent>
    </Card>
  );
}
