import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, AlertCircle, CheckCircle, Clock, MapPin, Calendar, TrendingUp } from 'lucide-react';

const PROMETRIC_CENTERS = [
  { id: 'cochin',     label: 'Cochin',     city: 'Kochi, Kerala' },
  { id: 'calicut',    label: 'Calicut',    city: 'Kozhikode, Kerala' },
  { id: 'trivandrum', label: 'Trivandrum', city: 'Thiruvananthapuram, Kerala' },
];

const STATUS_CONFIG = {
  available: { label: 'Available', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
  limited: { label: 'Limited', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Clock },
  unavailable: { label: 'Full', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle },
  unknown: { label: 'Unknown', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: AlertCircle },
};

function SeatStatusBadge({ status, seats }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
      {seats != null && seats > 0 && status !== 'unavailable' && (
        <span className="ml-1 font-bold">{seats}</span>
      )}
    </span>
  );
}

function AvailabilityCard({ record }) {
  const center = PROMETRIC_CENTERS.find(c => c.id === record.center_id) || {
    label: record.center_id,
    city: record.center_location || '',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">{center.label}</p>
            <p className="text-xs text-gray-500">{center.city}</p>
          </div>
        </div>
        <SeatStatusBadge status={record.status} seats={record.available_seats} />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <Calendar className="w-3 h-3" />
        <span>
          {record.exam_date
            ? new Date(record.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Date TBD'}
        </span>
        {record.exam_part && (
          <span className="ml-auto bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
            Part {record.exam_part}
          </span>
        )}
      </div>

      {record.notes && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-2">{record.notes}</p>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Updated {record.scraped_at
          ? new Date(record.scraped_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
          : '—'}
      </p>
    </div>
  );
}

function StatsBar({ records }) {
  const available = records.filter(r => r.status === 'available').length;
  const limited = records.filter(r => r.status === 'limited').length;
  const full = records.filter(r => r.status === 'unavailable').length;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[
        { label: 'Available', count: available, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Limited', count: limited, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { label: 'Full', count: full, color: 'text-red-600', bg: 'bg-red-50' },
      ].map(s => (
        <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
          <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
          <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export function CMAAvailabilityWidget() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [filterCenter, setFilterCenter] = useState('all');
  const [filterPart, setFilterPart] = useState('all');

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('cma_availability')
        .select('*')
        .order('exam_date', { ascending: true });

      if (filterCenter !== 'all') query = query.eq('center_id', filterCenter);
      if (filterPart !== 'all') query = query.eq('exam_part', filterPart);

      const { data, error: err } = await query;
      if (err) throw err;
      setRecords(data || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load availability data');
    } finally {
      setLoading(false);
    }
  }, [filterCenter, filterPart]);

  useEffect(() => {
    fetchAvailability();

    // Real-time subscription
    const channel = supabase
      .channel('cma_availability_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cma_availability' }, () => {
        fetchAvailability();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchAvailability]);

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4 md:p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            CMA Seat Availability
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Prometric center availability — live tracker
          </p>
        </div>
        <button
          onClick={fetchAvailability}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterCenter}
          onChange={e => setFilterCenter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Centers</option>
          {PROMETRIC_CENTERS.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <select
          value={filterPart}
          onChange={e => setFilterPart(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Parts</option>
          <option value="1">Part 1</option>
          <option value="2">Part 2</option>
        </select>

        {lastRefresh && (
          <span className="ml-auto self-center text-xs text-gray-400">
            Last updated: {lastRefresh.toLocaleTimeString('en-IN')}
          </span>
        )}
      </div>

      {/* Stats */}
      {!loading && !error && records.length > 0 && <StatsBar records={records} />}

      {/* Content */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading availability data…</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 text-sm">Failed to load data</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button onClick={fetchAvailability} className="text-xs text-red-700 underline mt-2">
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No availability data yet</p>
            <p className="text-sm mt-1">Run the scraper to populate seat data.</p>
          </div>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map(record => (
            <AvailabilityCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

export default CMAAvailabilityWidget;
