// GBP Service - Frontend API calls to Supabase Edge Function (gbp-proxy)
// All calls go through the edge function to keep credentials server-side

import { supabase } from './supabase'
import type {
  GBPBranch,
  GBPLocation,
  GBPReviewsResponse,
  GBPReview,
  GBPLocalPost,
  GBPCreatePostPayload,
  GBPQuestionsResponse,
  GBPInsightsResponse,
  GBPLocationSummary,
} from '../types/gbp.types'

// The Supabase Edge Function URL is resolved automatically via supabase client
const EDGE_FUNCTION = 'gbp-proxy'

/** Generic caller to the gbp-proxy edge function */
async function callGBP<T>(action: string, branch: GBPBranch, params: Record<string, string> = {}, body?: unknown): Promise<T> {
  const searchParams = new URLSearchParams({ action, branch, ...params })

  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    // Pass query params via the path
  })

  // Supabase functions.invoke doesn't support query params directly,
  // so we use fetch directly with the project URL
  if (error) throw error
  return data as T
}

/** Direct fetch to edge function (supports query params) */
async function gbpCall<T>(action: string, branch: GBPBranch, extraParams: Record<string, string> = {}, body?: unknown): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const params = new URLSearchParams({ action, branch, ...extraParams })
  const url = `${supabaseUrl}/functions/v1/${EDGE_FUNCTION}?${params}`

  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `GBP API error ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ── Location ──────────────────────────────────────────────────────────────
export const gbpLocationService = {
  async getLocation(branch: GBPBranch): Promise<GBPLocation> {
    return gbpCall<GBPLocation>('get-location', branch)
  },
}

// ── Reviews ───────────────────────────────────────────────────────────────
export const gbpReviewsService = {
  async listReviews(branch: GBPBranch, pageToken?: string, pageSize = 20): Promise<GBPReviewsResponse> {
    const extra: Record<string, string> = { pageSize: String(pageSize) }
    if (pageToken) extra.pageToken = pageToken
    return gbpCall<GBPReviewsResponse>('list-reviews', branch, extra)
  },

  async replyToReview(branch: GBPBranch, reviewName: string, comment: string): Promise<GBPReview> {
    return gbpCall<GBPReview>('reply-to-review', branch, {}, { reviewName, comment })
  },

  async deleteReply(branch: GBPBranch, reviewName: string): Promise<void> {
    return gbpCall<void>('delete-reply', branch, {}, { reviewName })
  },

  /** Get location summary: rating + unreplied count + recent 5 reviews */
  async getLocationSummary(branch: GBPBranch): Promise<GBPLocationSummary> {
    const [reviewsData, location] = await Promise.all([
      gbpReviewsService.listReviews(branch, undefined, 10),
      gbpLocationService.getLocation(branch).catch(() => undefined),
    ])
    const reviews = reviewsData.reviews ?? []
    const unrepliedCount = reviews.filter(r => !r.reviewReply).length
    return {
      branch,
      label: branch === 'cochin' ? 'FETS Cochin' : 'FETS Calicut',
      location,
      reviewCount: reviewsData.totalReviewCount ?? reviews.length,
      averageRating: reviewsData.averageRating ?? 0,
      recentReviews: reviews.slice(0, 5),
      unrepliedCount,
    }
  },
}

// ── Posts ─────────────────────────────────────────────────────────────────
export const gbpPostsService = {
  async listPosts(branch: GBPBranch): Promise<{ localPosts?: GBPLocalPost[] }> {
    return gbpCall('list-posts', branch)
  },

  async createPost(branch: GBPBranch, post: GBPCreatePostPayload): Promise<GBPLocalPost> {
    return gbpCall<GBPLocalPost>('create-post', branch, {}, { post })
  },

  async deletePost(branch: GBPBranch, postName: string): Promise<void> {
    return gbpCall<void>('delete-post', branch, {}, { postName })
  },
}

// ── Q&A ───────────────────────────────────────────────────────────────────
export const gbpQAService = {
  async listQuestions(branch: GBPBranch): Promise<GBPQuestionsResponse> {
    return gbpCall<GBPQuestionsResponse>('list-questions', branch)
  },

  async answerQuestion(branch: GBPBranch, questionName: string, text: string): Promise<void> {
    return gbpCall<void>('answer-question', branch, {}, { questionName, text })
  },
}

// ── Insights ──────────────────────────────────────────────────────────────
export const gbpInsightsService = {
  async getInsights(branch: GBPBranch, startDate?: string, endDate?: string): Promise<GBPInsightsResponse> {
    const extra: Record<string, string> = {}
    if (startDate) extra.startDate = startDate
    if (endDate) extra.endDate = endDate
    return gbpCall<GBPInsightsResponse>('get-insights', branch, extra)
  },
}

// ── OAuth setup helper (admin only) ──────────────────────────────────────────
export const gbpAuthService = {
  async getOAuthUrl(): Promise<string> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const res = await fetch(`${supabaseUrl}/functions/v1/${EDGE_FUNCTION}?action=get-oauth-url`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    })
    const data = await res.json()
    return data.url as string
  },
}
