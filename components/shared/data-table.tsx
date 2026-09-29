import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type Column<T> = {
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  /** Screen-reader-only header, e.g. for an actions column. */
  srOnlyHeader?: boolean
}

/**
 * A table on tablet and desktop. On phones it switches to cards when `mobileCard`
 * is given, otherwise it scrolls horizontally.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  mobileCard,
  empty,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  caption: string
  mobileCard?: (row: T) => React.ReactNode
  empty?: React.ReactNode
}) {
  if (rows.length === 0 && empty) return <>{empty}</>

  return (
    <>
      {mobileCard && (
        <ul className="space-y-3 md:hidden" aria-label={caption}>
          {rows.map((row) => (
            <li key={rowKey(row)}>{mobileCard(row)}</li>
          ))}
        </ul>
      )}
      <div className={cn("overflow-hidden rounded-xl border bg-card shadow-card", mobileCard && "hidden md:block")}>
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  className={cn("h-11 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase", column.className)}
                >
                  {column.srOnlyHeader ? <span className="sr-only">{column.header}</span> : column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column, index) => (
                  <TableCell key={index} className={cn("px-4 py-3", column.className)}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
