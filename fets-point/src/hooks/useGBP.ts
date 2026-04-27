// useGBP - React hooks for Google Business Profile data
// Provides loading/error state management for all GBP operations

import { useState, useEffect, useCallback } from 'react'
import type { GBPBranch, GBPReview, GBPLocalPost, GBPQuestion, GBPInsightsResponse, GBPLocationSummary } from '../types/gbp.types'
import {
  gbpReviewsService,
  gbpPostsService,
  gbpQAService,
  gbpInsightsService,
} from '../lib/gbpService'

// ── useGBPReviews ─────────────────────────────────────────────────────────
export function useGBPReviews(branch: GBPBranch) {
  const [reviews, setReviews] = useState<GBPReview[]>([])
  const [averageRating, setAverageRating] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextPageToken, setNextPageToken] = useState<string | undefined>()

  const fetchReviews = useCallback(async (pageToken?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await gbpReviewsService.listReviews(branch, pageToken)
      setReviews(prev => pageToken ? [...prev, ...(res.reviews ?? [])] : (res.reviews ?? []))
      setAverageRating(res.averageRating ?? 0)
      setTotalCount(res.totalReviewCount ?? 0)
      setNextPageToken(res.nextPageToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [branch])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const replyToReview = useCallback(async (reviewName: string, comment: string) => {
    const updated = await gbpReviewsService.replyToReview(branch, reviewName, comment)
    setReviews(prev => prev.map(r => r.name === reviewName ? { ...r, reviewReply: { comment } } : r))
    return updated
  }, [branch])

  const deleteReply = useCallback(async (reviewName: string) => {
    await gbpReviewsService.deleteReply(branch, reviewName)
    setReviews(prev => prev.map(r => r.name === reviewName ? { ...r, reviewReply: undefined } : r))
  }, [branch])

  return { reviews, averageRating, totalCount, loading, error, nextPageToken, fetchReviews, replyToReview, deleteReply }
}

// ── useGBPSummary (for dashboard widgets) ────────────────────────────────
export function useGBPSummary() {
  const [summaries, setSummaries] = useState<GBPLocationSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cochin, calicut] = await Promise.allSettled([
        gbpReviewsService.getLocationSummary('cochin'),
        gbpReviewsService.getLocationSummary('calicut'),
      ])
      const results: GBPLocationSummary[] = []
      if (cochin.status === 'fulfilled') results.push(cochin.value)
      if (calicut.status === 'fulfilled') results.push(calicut.value)
      setSummaries(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GBP summaries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { summaries, loading, error, refresh }
}

// ── useGBPPosts ────────────────────────────────────────────────────────────
export function useGBPPosts(branch: GBPBranch) {
  const [posts, setPosts] = useState<GBPLocalPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await gbpPostsService.listPosts(branch)
      setPosts(res.localPosts ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [branch])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const createPost = useCallback(async (postData: Parameters<typeof gbpPostsService.createPost>[1]) => {
    setSubmitting(true)
    try {
      const newPost = await gbpPostsService.createPost(branch, postData)
      setPosts(prev => [newPost, ...prev])
      return newPost
    } finally {
      setSubmitting(false)
    }
  }, [branch])

  const deletePost = useCallback(async (postName: string) => {
    await gbpPostsService.deletePost(branch, postName)
    setPosts(prev => prev.filter(p => p.name !== postName))
  }, [branch])

  return { posts, loading, error, submitting, fetchPosts, createPost, deletePost }
}

// ── useGBPQA ────────────────────────────────────────────────────────────────
export function useGBPQA(branch: GBPBranch) {
  const [questions, setQuestions] = useState<GBPQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await gbpQAService.listQuestions(branch)
      setQuestions(res.questions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Q&A')
    } finally {
      setLoading(false)
    }
  }, [branch])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const answerQuestion = useCallback(async (questionName: string, text: string) => {
    await gbpQAService.answerQuestion(branch, questionName, text)
    await fetchQuestions() // refresh to show answer
  }, [branch, fetchQuestions])

  return { questions, loading, error, fetchQuestions, answerQuestion }
}

// ── useGBPInsights ─────────────────────────────────────────────────────────
export function useGBPInsights(branch: GBPBranch, startDate?: string, endDate?: string) {
  const [insights, setInsights] = useState<GBPInsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await gbpInsightsService.getInsights(branch, startDate, endDate)
      setInsights(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [branch, startDate, endDate])

  useEffect(() => { fetchInsights() }, [fetchInsights])

  return { insights, loading, error, fetchInsights }
}
