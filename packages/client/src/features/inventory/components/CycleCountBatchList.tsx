import { useState } from 'react';
import { useCycleCounts, useCreateCycleCount } from '../hooks/useCycleCounts';
import { Plus, Clock, CheckCircle, FileText, XCircle } from 'lucide-react';
import { CycleCountGrid } from './CycleCountGrid';

export function CycleCountBatchList() {
  const [activeTab, setActiveTab] = useState('draft');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newType, setNewType] = useState('blind');
  const [newLocation, setNewLocation] = useState('');

  const { data: batches, isLoading } = useCycleCounts(activeTab !== 'all' ? activeTab : undefined);
  const createBatch = useCreateCycleCount();

  const handleCreate = async () => {
    try {
      const res = await createBatch.mutateAsync({ type: newType, location: newLocation });
      setShowNewModal(false);
      setActiveBatchId(res.id);
    } catch (err) {
      console.error(err);
    }
  };

  if (activeBatchId) {
    return <CycleCountGrid cycleCountId={activeBatchId} onClose={() => setActiveBatchId(null)} />;
  }

  const tabs = [
    { id: 'draft', label: 'Drafts', icon: FileText },
    { id: 'pending_approval', label: 'Pending Approval', icon: Clock },
    { id: 'posted', label: 'Posted', icon: CheckCircle },
    { id: 'cancelled', label: 'Cancelled', icon: XCircle },
    { id: 'all', label: 'All Batches', icon: FileText },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Batch Cycle Counts</h1>
        <button 
          onClick={() => setShowNewModal(true)}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New Cycle Count</span>
        </button>
      </div>

      <div className="flex space-x-4 mb-6 border-b border-input-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-2 flex items-center space-x-2 font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-input-border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-card-hover border-b border-input-border">
            <tr>
              <th className="p-4 text-sm font-medium text-secondary">Batch ID</th>
              <th className="p-4 text-sm font-medium text-secondary">Type</th>
              <th className="p-4 text-sm font-medium text-secondary">Location</th>
              <th className="p-4 text-sm font-medium text-secondary">Status</th>
              <th className="p-4 text-sm font-medium text-secondary">Date</th>
              <th className="p-4 text-sm font-medium text-secondary">Variance Value</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-secondary">Loading...</td></tr>
            ) : batches?.data?.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-secondary">No cycle counts found.</td></tr>
            ) : (
              batches?.data?.map((batch: any) => (
                <tr 
                  key={batch.id} 
                  className="border-b border-input-border/50 hover:bg-card-hover cursor-pointer transition-colors"
                  onClick={() => setActiveBatchId(batch.id)}
                >
                  <td className="p-4 font-mono text-sm">{batch.id.substring(0,8)}...</td>
                  <td className="p-4 uppercase text-xs font-bold text-primary">{batch.type}</td>
                  <td className="p-4">{batch.location || '-'}</td>
                  <td className="p-4 uppercase text-xs font-bold text-secondary">{batch.status}</td>
                  <td className="p-4 text-secondary">{new Date(batch.created_at).toLocaleDateString()}</td>
                  <td className="p-4 font-medium">EGP {Number(batch.total_variance_value).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-input-border overflow-hidden">
            <div className="p-6 border-b border-input-border flex justify-between items-center">
              <h2 className="text-xl font-bold">New Cycle Count</h2>
              <button onClick={() => setShowNewModal(false)} className="text-secondary hover:text-white">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Count Type</label>
                <select 
                  value={newType} 
                  onChange={e => setNewType(e.target.value)}
                  className="w-full bg-input-bg border border-input-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="blind">Blind Count (System quantities hidden)</option>
                  <option value="guided">Guided Count (System quantities visible)</option>
                  <option value="investigation">Investigation (Targeted checking)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Location / Zone (Optional)</label>
                <input 
                  type="text" 
                  value={newLocation} 
                  onChange={e => setNewLocation(e.target.value)}
                  placeholder="e.g. Aisle 4, Dairy Cooler"
                  className="w-full bg-input-bg border border-input-border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div className="p-6 border-t border-input-border bg-card-hover flex justify-end space-x-3">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-secondary hover:text-white font-medium">
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={createBatch.isPending}
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {createBatch.isPending ? 'Starting...' : 'Start Counting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
