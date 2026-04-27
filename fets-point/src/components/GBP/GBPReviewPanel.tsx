// GBPReviewPanel - Review management dashboard for Cochin & Calicut
// Shows all reviews, avg rating, unreplied count. Allows replying from fets.live

import React, { useState } from 'react'
import { useGBPReviews } from '../../hooks/useGBP'
import type { GBPBranch, GBPReview } from '../../types/gbp.types'
import { starRatingToNumber } from '../../types/gbp.types'

const STAR_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#22c55e' }

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= rating ? '#f59e0b' : '#d1d5db'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

function ReviewCard({ review, onReply, onDeleteReply }: {
  review: GBPReview
  onReply: (name: string, comment: string) => Promise<void>
  onDeleteReply: (name: string) => Promise<void>
}) {
  const [replyText, setReplyText] = useState(review.reviewReply?.comment ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const stars = starRatingToNumber[review.starRating]

  const handleSave = async () => {
    if (!replyText.trim()) return
    setSaving(true)
    try {
      await onReply(review.name, replyText)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this reply?')) return
    setSaving(true)
    try {
      await onDeleteReply(review.name)
      setReplyText('')
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {review.reviewer.isAnonymous ? '?' : review.reviewer.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{review.reviewer.isAnonymous ? 'Anonymous' : review.reviewer.displayName}</p>
            <p className="text-xs text-gray-400">{new Date(review.createTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        <StarRating rating={stars} />
      </div>

      {review.comment && (
        <p className="text-gray-700 text-sm mb-3 leading-relaxed">{review.comment}</p>
      )}

      {/* Reply section */}
      {!editing && review.reviewReply ? (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-blue-700">FETS Response</span>
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
              <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600" disabled={saving}>Delete</button>
            </div>
          </div>
          <p className="text-sm text-gray-700">{review.reviewReply.comment}</p>
        </div>
      ) : !editing ? (
        <button
          onClick={() => setEditing(true)}
          className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          <span>+</span> Add reply
        </button>
      ) : (
        <div className="mt-2">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            placeholder="Write your reply to this review..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving || !replyText.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Post Reply'}
            </button>
            <button onClick={() => { setEditing(false); setReplyText(review.reviewReply?.comment ?? '') }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BranchReviews({ branch }: { branch: GBPBranch }) {
  const { reviews, averageRating, totalCount, loading, error, nextPageToken, fetchReviews, replyToReview, deleteReply } = useGBPReviews(branch)
  const unreplied = reviews.filter(r => !r.reviewReply).length

  if (loading && reviews.length === 0) return (
    <div className="flex items-center justify-center py-10">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
      {error}
    </div>
  )

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{averageRating.toFixed(1)}</div>
          <StarRating rating={Math.round(averageRating)} size={12} />
          <p className="text-xs text-gray-500 mt-1">Avg Rating</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
          <p className="text-xs text-gray-500 mt-1">Total Reviews</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-red-500">{unreplied}</div>
          <p className="text-xs text-gray-500 mt-1">Unreplied</p>
        </div>
      </div>

      {/* Reviews list */}
      <div className="max-h-[500px] overflow-y-auto pr-1">
        {reviews.map(review => (
          <ReviewCard
            key={review.reviewId}
            review={review}
            onReply={replyToReview}
            onDeleteReply={deleteReply}
          />
        ))}
      </div>

      {nextPageToken && (
        <button
          onClick={() => fetchReviews(nextPageToken)}
          disabled={loading}
          className="mt-3 w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 text-sm rounded-lg border border-gray-200"
        >
          {loading ? 'Loading...' : 'Load more reviews'}
        </button>
      )}
    </div>
  )
}

export function GBPReviewPanel() {
  const [activeTab, setActiveTab] = useState<GBPBranch>('cochin')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Google Reviews</h2>
          <p className="text-xs text-gray-400">Manage reviews for both FETS locations</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['cochin', 'calicut'] as GBPBranch[]).map(branch => (
            <button
              key={branch}
              onClick={() => setActiveTab(branch)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === branch
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {branch === 'cochin' ? 'Cochin' : 'Calicut'}
            </button>
          ))}
        </div>
      </div>
      <BranchReviews key={activeTab} branch={activeTab} />
    </div>
  )
}
