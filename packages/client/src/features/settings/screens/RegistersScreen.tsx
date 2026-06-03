import { Store } from 'lucide-react';

export function RegistersScreen() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">Terminals & Registers</h3>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          + Add Register
        </button>
      </div>
      
      <div className="bg-input border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-card-hover border-b border-border text-secondary">
            <tr>
              <th className="px-6 py-3 font-medium">Register Name</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Placeholder data since we don't have a CRUD endpoint for registers yet */}
            <tr className="hover:bg-card-hover/40">
              <td className="px-6 py-4 font-medium flex items-center space-x-3">
                <Store size={16} className="text-neutral-500" />
                <span>Main Register 01</span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                  Active
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-primary hover:underline font-medium text-sm">Edit</button>
              </td>
            </tr>
            <tr className="hover:bg-card-hover/40">
              <td className="px-6 py-4 font-medium flex items-center space-x-3">
                <Store size={16} className="text-neutral-500" />
                <span>Backup Register 02</span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                  Active
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-primary hover:underline font-medium text-sm">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
