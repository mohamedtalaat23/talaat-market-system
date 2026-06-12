/**
 * InventoryTableSkeleton
 *
 * Pulse-loading placeholder matching InventoryTable column layout:
 * Product | Barcode | Selling Price | Warning Limit | In Stock | Status | Actions
 */
export function InventoryTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden border border-border bg-neutral-900">
      <table className="w-full text-xs" role="presentation">
        <thead className="bg-neutral-950 border-b border-border">
          <tr className="h-9">
            <th className="px-4 w-[28%]" />
            <th className="px-4 w-[18%]" />
            <th className="px-4 w-[12%]" />
            <th className="px-4 w-[12%]" />
            <th className="px-4 w-[12%]" />
            <th className="px-4 w-[10%]" />
            <th className="px-4 w-[8%]" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1F1F1F]">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="h-9">
              {/* Product name */}
              <td className="px-4 py-1">
                <div className="h-3.5 w-36 rounded bg-neutral-800 animate-pulse mb-1" />
                <div className="h-2.5 w-24 rounded bg-neutral-800/50 animate-pulse" />
              </td>
              {/* Barcode */}
              <td className="px-4 py-1">
                <div className="h-3 w-28 rounded bg-neutral-800 animate-pulse" />
              </td>
              {/* Selling price */}
              <td className="px-4 py-1 text-end">
                <div className="h-3 w-14 rounded bg-neutral-800 animate-pulse ms-auto" />
              </td>
              {/* Warning limit */}
              <td className="px-4 py-1 text-end">
                <div className="h-3 w-10 rounded bg-neutral-800 animate-pulse ms-auto" />
              </td>
              {/* In stock */}
              <td className="px-4 py-1 text-end">
                <div className="h-3 w-10 rounded bg-neutral-800 animate-pulse ms-auto" />
              </td>
              {/* Status badge */}
              <td className="px-4 py-1 text-center">
                <div className="h-4 w-12 rounded bg-neutral-800 animate-pulse mx-auto" />
              </td>
              {/* Actions */}
              <td className="px-4 py-1 text-center">
                <div className="h-6 w-16 rounded bg-neutral-800 animate-pulse mx-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
