// Google Business Profile TypeScript Types
// Used across GBP components, hooks, and services

export type GBPBranch = 'cochin' | 'calicut'

// ── Location ──────────────────────────────────────────────────────────────
export interface GBPPhoneNumber {
  primaryPhone: string
  additionalPhones?: string[]
}

export interface GBPTimePoint {
  hours: number
  minutes: number
}

export interface GBPTimePeriod {
  openDay: string
  openTime: GBPTimePoint
  closeDay: string
  closeTime: GBPTimePoint
}

export interface GBPRegularHours {
  periods: GBPTimePeriod[]
}

export interface GBPLocation {
  name: string
  title: string
  phoneNumbers?: GBPPhoneNumber
  regularHours?: GBPRegularHours
  websiteUri?: string
  profile?: { description: string }
}

// ── Reviews ───────────────────────────────────────────────────────────────
export type GBPStarRating = 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'

export interface GBPReviewerInfo {
  profilePhotoUrl?: string
  displayName: string
  isAnonymous: boolean
}

export interface GBPReviewReply {
  comment: string
  updateTime?: string
}

export interface GBPReview {
  name: string
  reviewId: string
  reviewer: GBPReviewerInfo
  starRating: GBPStarRating
  comment?: string
  createTime: string
  updateTime: string
  reviewReply?: GBPReviewReply
}

export interface GBPReviewsResponse {
  reviews?: GBPReview[]
  averageRating?: number
  totalReviewCount?: number
  nextPageToken?: string
}

// ── Posts ─────────────────────────────────────────────────────────────────
export type GBPPostTopicType =
  | 'STANDARD'
  | 'EVENT'
  | 'OFFER'
  | 'ALERT'

export type GBPPostState = 'LIVE' | 'REJECTED' | 'PROCESSING'

export interface GBPPostCallToAction {
  actionType: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL'
  url?: string
}

export interface GBPLocalPost {
  name: string
  languageCode?: string
  summary: string
  callToAction?: GBPPostCallToAction
  createTime?: string
  updateTime?: string
  topicType: GBPPostTopicType
  state?: GBPPostState
  searchUrl?: string
  media?: Array<{ mediaFormat: string; sourceUrl: string }>
}

export interface GBPCreatePostPayload {
  languageCode?: string
  summary: string
  topicType: GBPPostTopicType
  callToAction?: GBPPostCallToAction
}

// ── Q&A ───────────────────────────────────────────────────────────────────
export interface GBPAnswer {
  name: string
  author: { displayName: string; type: 'MERCHANT' | 'REGULAR_USER' }
  upvoteCount: number
  text: string
  createTime: string
  updateTime?: string
}

export interface GBPQuestion {
  name: string
  author: { displayName: string; profilePhotoUri?: string; type: string }
  upvoteCount: number
  text: string
  createTime: string
  updateTime?: string
  topAnswers?: GBPAnswer[]
  totalAnswerCount?: number
}

export interface GBPQuestionsResponse {
  questions?: GBPQuestion[]
  nextPageToken?: string
  totalSize?: number
}

// ── Insights ──────────────────────────────────────────────────────────────
export type GBPMetric =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'CALL_CLICKS'
  | 'DIRECTION_REQUESTS'
  | 'WEBSITE_CLICKS'

export interface GBPDailyValue {
  date: { year: number; month: number; day: number }
  value: string
}

export interface GBPTimeSeries {
  datedValues: GBPDailyValue[]
}

export interface GBPMetricTimeSeries {
  dailyMetric: GBPMetric
  dailySubEntityType?: string
  timeSeries: GBPTimeSeries
}

export interface GBPInsightsResponse {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetric: GBPMetric
    dailySubEntityType?: unknown
    timeSeries: GBPTimeSeries
  }>
}

// ── Aggregated summary for dashboard ──────────────────────────────────────
export interface GBPLocationSummary {
  branch: GBPBranch
  label: string
  location?: GBPLocation
  reviewCount: number
  averageRating: number
  recentReviews: GBPReview[]
  unrepliedCount: number
}

// ── Star rating number helper ──────────────────────────────────────────────
export const starRatingToNumber: Record<GBPStarRating, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}
