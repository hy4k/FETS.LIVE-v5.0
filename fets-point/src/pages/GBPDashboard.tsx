import React, { useState } from 'react';
import { GBPReviewPanel } from '../components/GBP';
import { GBPInsightsPanel } from '../components/GBP';
import { GBPPostPublisher } from '../components/GBP';
import { GBPQandA } from '../components/GBP';
import { useGBP } from '../hooks/useGBP';

type GBPTab = 'overview' | 'reviews' | 'posts' | 'qa' | 'insights';
type Branch = 'cochin' | 'calicut';

const GBPDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GBPTab>('overview');
  const [activeBranch, setActiveBranch] = useState<Branch>('cochin');
  const { businessInfo, loading, error } = useGBP(activeBranch);

  const tabs: { id: GBPTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '\uD83C\uDFE2' },
    { id: 'reviews', label: 'Reviews', icon: '\u2B50' },
    { id: 'posts', label: 'Posts', icon: '\uD83D\uDCDD' },
    { id: 'qa', label: 'Q&A', icon: '\u2753' },
    { id: 'insights', label: 'Insights', icon: '\uD83D\uDCCA' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Google Business Profile</h1>
            <p className="text-gray-500 mt-1">Manage your FETS.LIVE presence on Google</p>
          </div>
          {/* Branch Selector */}
          <div className="flex gap-2 bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
            {(['cochin', 'calicut'] as Branch[]).map((branch) => (
              <button
                key={branch}
                onClick={() => setActiveBranch(branch)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeBranch === branch
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {branch === 'cochin' ? 'Cochin' : 'Calicut'}
              </button>
            ))}
          </div>
        </div>

        {/* Business Info Card */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
          </div>
        ) : businessInfo ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">\uD83C\uDFEB</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{businessInfo.title}</h2>
                <p className="text-gray-500 text-sm">{businessInfo.storefrontAddress?.addressLines?.join(', ')}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  businessInfo.openInfo?.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {businessInfo.openInfo?.status === 'OPEN' ? 'Open Now' : 'Closed'}
                </span>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-bold text-gray-900">{businessInfo.metadata?.mapsUri ? '\uD83D\uDCCD' : ''}</p>
              </div>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 shadow-sm mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GBPReviewPanel />
              <GBPInsightsPanel />
            </div>
          )}
          {activeTab === 'reviews' && <GBPReviewPanel />}
          {activeTab === 'posts' && <GBPPostPublisher />}
          {activeTab === 'qa' && <GBPQandA />}
          {activeTab === 'insights' && <GBPInsightsPanel />}
        </div>
      </div>
    </div>
  );
};

export default GBPDashboard;
