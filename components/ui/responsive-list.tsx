import { Key, ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileCard } from "@/components/ui/mobile-card";

export interface ResponsiveListColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  headClassName?: string;
  cellClassName?: string;
  /** Set to `false` for a mobile-only field with no desktop table column (`cell` is then unused). Defaults to true. */
  showInTable?: boolean;
  /** Label prefixed to the value in the mobile card, e.g. "Grade Level". Omit for unlabeled fields. */
  mobileLabel?: ReactNode;
  /** Override how this field renders on mobile; pass `null` to leave it out of the card body (e.g. it's already shown via `mobileTitle`/`mobileAction`). Defaults to `cell`. */
  mobileCell?: ((row: T, index: number) => ReactNode) | null;
  mobileClassName?: string;
  /** Columns sharing the same group render together in one tight block instead of each getting the card's default spacing. */
  mobileGroup?: string;
}

interface ResponsiveListProps<T> {
  columns: ResponsiveListColumn<T>[];
  /** Rows shown in the desktop table. */
  rows: T[];
  /** Rows shown in the mobile card list; defaults to `rows`. Separate because mobile typically uses "Load More" while desktop uses page-number pagination. */
  mobileRows?: T[];
  rowKey: (row: T, index: number) => Key;
  tableClassName?: string;
  /** Extra classes for the desktop table's wrapper div (in addition to "hidden md:block w-full"), e.g. "overflow-x-auto rounded-lg border". */
  desktopWrapperClassName?: string;
  mobileTitle: (row: T, index: number) => ReactNode;
  mobileSubtitle?: (row: T, index: number) => ReactNode;
  mobileAction?: (row: T, index: number) => ReactNode;
  /** Rendered inside each mobile card, after the field list — e.g. a row of action buttons. */
  mobileCardFooter?: (row: T, index: number) => ReactNode;
  /** Rendered after the mobile card list, inside the same md:hidden wrapper — e.g. a LoadMoreButton. */
  mobileFooter?: ReactNode;
}

/**
 * Renders one dataset as a desktop table and a mobile card list from a single column
 * definition, so a field only needs to be described once instead of once per layout.
 */
export function ResponsiveList<T>({
  columns,
  rows,
  mobileRows = rows,
  rowKey,
  tableClassName,
  desktopWrapperClassName,
  mobileTitle,
  mobileSubtitle,
  mobileAction,
  mobileCardFooter,
  mobileFooter,
}: ResponsiveListProps<T>) {
  const tableColumns = columns.filter((column) => column.showInTable !== false);
  const mobileColumns = columns.filter((column) => column.mobileCell !== null);
  const mobileSegments: ResponsiveListColumn<T>[][] = [];
  for (const column of mobileColumns) {
    const lastSegment = mobileSegments[mobileSegments.length - 1];
    const lastColumn = lastSegment?.[lastSegment.length - 1];
    if (column.mobileGroup && lastColumn?.mobileGroup === column.mobileGroup) {
      lastSegment.push(column);
    } else {
      mobileSegments.push([column]);
    }
  }

  return (
    <>
      <div
        className={["hidden md:block w-full", desktopWrapperClassName].filter(Boolean).join(" ")}
      >
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow>
              {tableColumns.map((column) => (
                <TableHead key={column.key} className={column.headClassName}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {tableColumns.map((column) => (
                  <TableCell key={column.key} className={column.cellClassName}>
                    {column.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-4">
        {mobileRows.map((row, index) => (
          <MobileCard key={rowKey(row, index)}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold text-base">{mobileTitle(row, index)}</div>
                {mobileSubtitle && (
                  <div className="text-sm text-muted-foreground">{mobileSubtitle(row, index)}</div>
                )}
              </div>
              {mobileAction?.(row, index)}
            </div>
            {mobileSegments.map((segment) => {
              const fields = segment.map((column) => (
                <div key={column.key}>
                  {column.mobileLabel != null && <>{column.mobileLabel}: </>}
                  {(column.mobileCell ?? column.cell)(row, index)}
                </div>
              ));
              return segment.length > 1 ? (
                <div key={segment[0].key} className="text-sm space-y-1">
                  {fields}
                </div>
              ) : (
                <div key={segment[0].key} className={segment[0].mobileClassName ?? "text-sm"}>
                  {fields}
                </div>
              );
            })}
            {mobileCardFooter?.(row, index)}
          </MobileCard>
        ))}
        {mobileFooter}
      </div>
    </>
  );
}
