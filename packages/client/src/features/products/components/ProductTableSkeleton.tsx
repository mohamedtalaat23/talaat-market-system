/**
 * ProductTableSkeleton
 *
 * Pulse-loading placeholder that matches the exact column layout of ProductTable.
 * Prevents layout shift during the initial page-1 load.
 *
 * Columns: Name/Desc | Barcode | Category | Cost | Selling | Stock | Status | Actions
 */
export function ProductTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden border border-border rounded bg-card">
      <table className="w-full text-sm" role="presentation">
        {/* Matching header so column widths lock to the same layout */}
        <thead className="bg-card-hover border-b border-border">
          <tr>
            <th className="p-4 w-[22%]" />
            <th className="p-4 w-[14%]" />
            <th className="p-4 w-[14%]" />
            <th className="p-4 w-[10%]" />
            <th className="p-4 w-[10%]" />
            <th className="p-4 w-[10%]" />
            <th className="p-4 w-[10%]" />
            <th className="p-4 w-[10%]" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="h-[60px]">
              {/* Name / Desc */}
              <td className="p-4">
                <div className="h-4 w-32 rounded bg-neutral-800 animate-pulse mb-1.5" />
                <div className="h-3 w-20 rounded bg-neutral-800/60 animate-pulse" />
              </td>
              {/* Barcode */}
              <td className="p-4">
                <div className="h-3.5 w-28 rounded bg-neutral-800 animate-pulse" />
              </td>
              {/* Category */}
              <td className="p-4">
                <div className="h-3.5 w-20 rounded bg-neutral-800 animate-pulse" />
              </td>
              {/* Cost */}
              <td className="p-4 text-end">
                <div className="h-3.5 w-16 rounded bg-neutral-800 animate-pulse ms-auto" />
              </td>
              {/* Selling */}
              <td className="p-4 text-end">
                <div className="h-3.5 w-16 rounded bg-neutral-800 animate-pulse ms-auto" />
              </td>
              {/* Stock */}
              <td className="p-4 text-end">
                <div className="h-3.5 w-12 rounded bg-neutral-800 animate-pulse ms-auto" />
              </td>
              {/* Status */}
              <td className="p-4 text-center">
                <div className="h-5 w-14 rounded-full bg-neutral-800 animate-pulse mx-auto" />
              </td>
              {/* Actions */}
              <td className="p-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-6 w-6 rounded bg-neutral-800 animate-pulse" />
                  <div className="h-6 w-6 rounded bg-neutral-800 animate-pulse" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
