import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  RefreshCw, AlertCircle, CheckCircle, Clock, MapPin,
  Calendar, GraduationCap, Pencil, X, Save, ExternalLink
} from 'lucide-react';

const CENTERS = [
  { id: 'cochin',  label: 'Cochin',  city: 'Kochi, Kerala' },
  { id: 'calicut', label: 'Calicut', city: 'Kozhikode, Kerala' },
];

const STATUS_OPTIONS = [
  { value: 'available',   label: 'Available',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  dot: 'bg-green-500',  icon: CheckCircle },
  { value: 'limited',     label: 'Limited',    color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', dot: 'bg-yellow-500', icon: Clock },
  { value: 'unavailable', label: 'Full',       color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300',    dot: 'bg-red-500',    icon: AlertCircle },
  { value: 'unknown',     label: 'Unknown',    color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400',   icon: AlertCircle },
];

function statusConfig(status) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[3];
}

function StatusBadge({ status, seats }) {
  const cfg = statusConfig(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
      {seats != null && seats > 0 && status !== 'unavailable' && (
        <span className="font-bold">· {seats} seats</span>
      )}
    </span>
  );
}

// Inline edit form shown below a card when "Update" is clicked
function UpdateForm({ record, onSave, onCancel }) {
  const [status, setStatus] = useState(record.status);
  const [seats, setSeats] = useState(record.available_seats ?? '');
  const [notes, setNotes] = useState(record.notes || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    setSaving(true);
    setErr('');
    const { error } = await supabase
      .from('cma_availability')
      .update({
        status,
        available_seats: seats === '' ? null : Number(seats),
        notes: notes.trim() || null,
        scraped_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSave();
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      {/* Status buttons */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
        <div className="grid grid-cols-2 gap-1.5">
          {STATUS_OPTIONS.filter(s => s.value !== 'unknown').map(s => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                status === s.value
                  ? `${s.bg} ${s.border} ${s.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seat count */}
      {status !== 'unavailable' && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Seats available (optional)</p>
          <input
            type="number"
            min="0"
            value={seats}
            onChange={e => setSeats(e.target.value)}
            placeholder="e.g. 3"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-400 focus:outline-none"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notes (optional)</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Next slot: May 15. Checked on Prometric portal."
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-teal-400 focus:outline-none"
        />
      </div>

      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CenterCard({ record, canEdit, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const center = CENTERS.find(c => c.id === record.center_id) || { label: record.center_id, city: '' };
  const cfg = statusConfig(record.status);

  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${cfg.border} ${cfg.bg}`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
            <MapPin className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{center.label}</p>
            <p className="text-[10px] text-gray-400">{center.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            Part {record.exam_part}
          </span>
          {canEdit && (
            <button
              onClick={() => setEditing(e => !e)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-white border border-transparent hover:border-gray-200 transition-all"
              title="Update status"
            >
              {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-3">
        <StatusBadge status={record.status} seats={record.available_seats} />
      </div>

      {/* Notes */}
      {record.notes && !record.notes.startsWith('Awaiting') && !record.notes.startsWith('Scrape error') && (
        <p className="mt-2 text-xs text-gray-600 leading-relaxed">{record.notes}</p>
      )}

      {/* Last updated */}
      <p className="mt-2 text-[10px] text-gray-400">
        Updated {record.scraped_at
          ? new Date(record.scraped_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '—'}
      </p>

      {/* Inline edit form */}
      {editing && (
        <UpdateForm
          record={record}
          onSave={() => { setEditing(false); onUpdated(); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export function CMAAvailabilityWidget() {
  const { profile } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Admins and super_admins can update status manually
  const canEdit = ['admin', 'super_admin', 'manager'].includes(profile?.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('cma_availability')
        .select('*')
        .in('center_id', ['cochin', 'calicut'])
        .order('center_id')
        .order('exam_part');
      if (err) throw err;
      setRecords(data || []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const ch = supabase
      .channel('cma_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cma_availability' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchData]);

  const available = records.filter(r => r.status === 'available').length;
  const limited   = records.filter(r => r.status === 'limited').length;
  const full      = records.filter(r => r.status === 'unavailable').length;

  return (
    <div className="flex flex-col min-h-full bg-[#0f2a2d] p-4 md:p-6 overflow-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-tight">CMA US</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Prometric Seat Availability</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-teal-600/20 border border-teal-500/30 text-teal-400 text-xs font-bold rounded-xl hover:bg-teal-600/30 disabled:opacity-40 transition-all uppercase tracking-wider"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Available', count: available, color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
            { label: 'Limited',   count: limited,   color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
            { label: 'Full',      count: full,       color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
              <p className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Admin update hint */}
      {canEdit && !loading && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-teal-500/10 border border-teal-500/20 rounded-xl">
          <Pencil className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
          <p className="text-xs text-teal-300">
            Tap the <span className="font-bold">pencil icon</span> on any card to update availability after checking Prometric.
          </p>
          <a
            href="https://proscheduler.prometric.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[10px] text-teal-400 underline underline-offset-2 whitespace-nowrap"
          >
            Open Prometric <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-white/40">Loading…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-300 text-sm">Failed to load</p>
            <p className="text-xs text-red-400 mt-1">{error}</p>
            <button onClick={fetchData} className="text-xs text-red-300 underline mt-2">Retry</button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {records.map(r => (
            <CenterCard
              key={r.id}
              record={r}
              canEdit={canEdit}
              onUpdated={fetchData}
            />
          ))}
        </div>
      )}

      {/* Last refresh */}
      {lastRefresh && !loading && (
        <p className="mt-5 text-center text-[10px] text-white/20">
          Fetched at {lastRefresh.toLocaleTimeString('en-IN')}
        </p>
      )}
    </div>
  );
}

export default CMAAvailabilityWidget;
