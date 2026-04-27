// GBPPostPublisher - Create and manage Google Business Profile posts
// Publish exam announcements, updates to both Cochin & Calicut Google listings

import React, { useState } from 'react'
import { useGBPPosts } from '../../hooks/useGBP'
import type { GBPBranch, GBPLocalPost, GBPPostTopicType } from '../../types/gbp.types'

const POST_TYPES: { type: GBPPostTopicType; label: string; icon: string; description: string }[] = [
  { type: 'STANDARD', label: 'Update', icon: '📝', description: 'General announcement or news' },
  { type: 'EVENT', label: 'Event', icon: '📅', description: 'Exam dates, scheduled sessions' },
  { type: 'OFFER', label: 'Offer', icon: '🎫', description: 'Special promotions or discounts' },
  { type: 'ALERT', label: 'Alert', icon: '⚠️', description: 'Important notices or changes' },
]

const FETS_TEMPLATES = [
  { label: 'Exam Slots Open', text: 'New exam slots are now open at FETS {branch} for upcoming sessions. Visit fets.live to register and book your preferred date.' },
  { label: 'Result Announcement', text: 'Congratulations to all candidates who appeared for their exams at FETS {branch}. Results are now available on fets.live.' },
  { label: 'Schedule Change', text: 'Important notice: Exam schedule has been updated at FETS {branch}. Please check fets.live for your revised timings.' },
  { label: 'Holiday Notice', text: 'FETS {branch} will be closed on this holiday. Please plan your exam bookings accordingly. Visit fets.live for available slots.' },
]

function PostCard({ post, onDelete }: { post: GBPLocalPost; onDelete: (name: string) => Promise<void> }) {
  const [deleting, setDeleting] = useState(false)
  const typeInfo = POST_TYPES.find(t => t.type === post.topicType)

  const handleDelete = async () => {
    if (!confirm('Delete this post from Google Business Profile?')) return
    setDeleting(true)
    try { await onDelete(post.name) }
    finally { setDeleting(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{typeInfo?.icon ?? '📝'}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            post.state === 'LIVE' ? 'bg-green-100 text-green-700' :
            post.state === 'REJECTED' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {post.state ?? 'Processing'}
          </span>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{post.summary}</p>
      {post.createTime && (
        <p className="text-xs text-gray-400 mt-2">
          {new Date(post.createTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}

function BranchPosts({ branch }: { branch: GBPBranch }) {
  const { posts, loading, error, submitting, createPost, deletePost } = useGBPPosts(branch)
  const [summary, setSummary] = useState('')
  const [postType, setPostType] = useState<GBPPostTopicType>('STANDARD')
  const [publishTo, setPublishTo] = useState<'single' | 'both'>('single')
  const [success, setSuccess] = useState(false)

  const handlePost = async () => {
    if (!summary.trim()) return
    try {
      await createPost({ summary, topicType: postType, languageCode: 'en' })
      setSummary('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      alert('Failed to publish post: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const applyTemplate = (template: string) => {
    setSummary(template.replace('{branch}', branch === 'cochin' ? 'Cochin' : 'Calicut'))
  }

  return (
    <div>
      {/* Compose area */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">NEW POST</p>

        {/* Post type selector */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {POST_TYPES.map(t => (
            <button
              key={t.type}
              onClick={() => setPostType(t.type)}
              className={`rounded-lg p-2 text-center transition-all ${
                postType === t.type
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-blue-50'
              }`}
            >
              <div className="text-lg">{t.icon}</div>
              <div className="text-xs font-medium mt-0.5">{t.label}</div>
            </button>
          ))}
        </div>

        {/* Templates */}
        <div className="flex flex-wrap gap-1 mb-3">
          {FETS_TEMPLATES.map(t => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t.text)}
              className="text-xs bg-white border border-gray-200 hover:border-blue-300 text-gray-600 px-2 py-1 rounded-lg"
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          rows={4}
          placeholder="Write your announcement here... (will appear on Google Maps listing)"
          maxLength={1500}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{summary.length}/1500 characters</span>
          <button
            onClick={handlePost}
            disabled={submitting || !summary.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
          >
            {submitting ? (
              <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Publishing...</>
            ) : (
              <>📎 Publish to Google</>
            )}
          </button>
        </div>
        {success && (
          <div className="mt-2 text-sm text-green-600 bg-green-50 rounded-lg p-2 text-center">
            Post published to Google Business Profile!
          </div>
        )}
      </div>

      {/* Existing posts */}
      {loading && posts.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">No posts yet. Create your first post above.</div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto">
          {posts.map(post => (
            <PostCard key={post.name} post={post} onDelete={deletePost} />
          ))}
        </div>
      )}
    </div>
  )
}

export function GBPPostPublisher() {
  const [activeTab, setActiveTab] = useState<GBPBranch>('cochin')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Google Posts</h2>
          <p className="text-xs text-gray-400">Publish announcements to your Google Maps listing</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['cochin', 'calicut'] as GBPBranch[]).map(branch => (
            <button
              key={branch}
              onClick={() => setActiveTab(branch)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === branch ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {branch === 'cochin' ? 'Cochin' : 'Calicut'}
            </button>
          ))}
        </div>
      </div>
      <BranchPosts key={activeTab} branch={activeTab} />
    </div>
  )
}
