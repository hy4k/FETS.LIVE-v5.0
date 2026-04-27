// GBPInsightsPanel - Analytics dashboard showing Google Business Profile performance
// Displays search impressions, calls, directions, website clicks for Cochin & Calicut

import React, { useState } from 'react'
import { useGBPInsights } from '../../hooks/useGBP'
import type { GBPBranch, GBPMetric } from '../../types/gbp.types'

const METRIC_LABELS: Record<GBPMetric, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'Desktop Maps',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'Desktop Search',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'Mobile Maps',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'Mobile Search',
  CALL_CLICKS: 'Call Clicks',
  DIRECTION_REQUESTS: 'Direction Requests',
  WEBSITE_CLICKS: 'Website Clicks',
}

const METRIC_COLORS: Record<GBPMetric, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: '#3b82f6',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: '#8b5cf6',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: '#06b6d4',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: '#10b981',
  CALL_CLICKS: '#f59e0b',
  DIRECTION_REQUESTS: '#ef4444',
  WEBSITE_CLICKS: '#ec4899',
}

const METRIC_ICONS: Record<GBPMetric, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: '🗺️',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: '🔍',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: '📱',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: '🔎',
  CALL_CLICKS: '📞',
  DIRECTION_REQUESTS: '🧭',
  WEBSITE_CLICKS: '🌐',
}

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '28 days', days: 28 },
  { label: '90 days', days: 90 },
]

function getDateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function sumTimeSeries(datedValues: Array<{ date: unknown; value: string }>): number {
  return datedValues.reduce((sum, v) => sum + parseInt(v.value || '0', 10), 0)
}

function MetricCard({ metric, total, color, icon, label }: {
  metric: GBPMetric
  total: number
  color: string
  icon: string
  label: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '20', color }}>
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{total.toLocaleString('en-IN')}</div>
      <div className="text-xs text-gray-400 mt-1">{METRIC_LABELS[metric]}</div>
    </div>
  )
}

function BranchInsights({ branch, days }: { branch: GBPBranch; days: number }) {
  const startDate = getDateDaysAgo(days)
  const endDate = getTodayDate()
  const { insights, loading, error } = useGBPInsights(branch, startDate, endDate)

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      <span className="ml-2 text-sm text-gray-500">Loading insights...</span>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">{error}</div>
  )

  if (!insights?.multiDailyMetricTimeSeries?.length) return (
    <div className="text-center py-8 text-gray-400 text-sm">
      No insights data available yet. This requires GBP API access approval.
    </div>
  )

  const metricMap = new Map<GBPMetric, number>()
  insights.multiDailyMetricTimeSeries.forEach(series => {
    const total = sumTimeSeries(series.timeSeries.datedValues)
    metricMap.set(series.dailyMetric, total)
  })

  // Summary KPIs
  const totalImpressions = (
    (metricMap.get('BUSINESS_IMPRESSIONS_DESKTOP_MAPS') ?? 0) +
    (metricMap.get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') ?? 0) +
    (metricMap.get('BUSINESS_IMPRESSIONS_MOBILE_MAPS') ?? 0) +
    (metricMap.get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH') ?? 0)
  )

  return (
    <div>
      {/* KPI Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalImpressions.toLocaleString('en-IN')}</div>
          <p className="text-xs text-gray-500 mt-1">Total Impressions</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{(metricMap.get('CALL_CLICKS') ?? 0).toLocaleString('en-IN')}</div>
          <p className="text-xs text-gray-500 mt-1">Calls</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-500">{(metricMap.get('DIRECTION_REQUESTS') ?? 0).toLocaleString('en-IN')}</div>
          <p className="text-xs text-gray-500 mt-1">Directions</p>
        </div>
      </div>

      {/* Full metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(METRIC_LABELS) as GBPMetric[]).map(metric => (
          <MetricCard
            key={metric}
            metric={metric}
            total={metricMap.get(metric) ?? 0}
            color={METRIC_COLORS[metric]}
            icon={METRIC_ICONS[metric]}
            label={METRIC_LABELS[metric].split(' ').pop()!}
          />
        ))}
      </div>
    </div>
  )
}

export function GBPInsightsPanel() {
  const [activeTab, setActiveTab] = useState<GBPBranch>('cochin')
  const [activeDays, setActiveDays] = useState(28)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">GBP Insights</h2>
          <p className="text-xs text-gray-400">Search impressions, calls & directions from Google</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['cochin', 'calicut'] as GBPBranch[]).map(branch => (
            <button
              key={branch}
              onClick={() => setActiveTab(branch)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === branch ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {branch === 'cochin' ? 'Cochin' : 'Calicut'}
            </button>
          ))}
        </div>
      </div>

      {/* Date range picker */}
      <div className="flex gap-2 mb-4">
        {DATE_RANGES.map(range => (
          <button
            key={range.days}
            onClick={() => setActiveDays(range.days)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeDays === range.days
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            Last {range.label}
          </button>
        ))}
      </div>

      <BranchInsights key={`${activeTab}-${activeDays}`} branch={activeTab} days={activeDays} />
    </div>
  )
}
