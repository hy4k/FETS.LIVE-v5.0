// GBPQandA - Google Business Profile Q&A Manager
// View and answer candidate questions from Google Maps for Cochin & Calicut

import React, { useState } from 'react'
import { useGBPQA } from '../../hooks/useGBP'
import type { GBPBranch, GBPQuestion } from '../../types/gbp.types'

const FETS_FAQ_TEMPLATES = [
  { q: 'What ID is required?', a: 'Candidates must bring a valid government-issued photo ID (Aadhaar, PAN, Passport, or Driving License) on the day of the exam.' },
  { q: 'Can I reschedule?', a: 'Yes, rescheduling is allowed subject to seat availability. Please visit fets.live or call us at least 48 hours before your exam date.' },
  { q: 'What time should I arrive?', a: 'Please arrive at least 30 minutes before your scheduled exam time. Late arrivals may not be admitted.' },
  { q: 'Is there parking?', a: 'Yes, parking is available at the FETS center. Please check fets.live for location-specific details.' },
]

function QuestionCard({ question, onAnswer }: {
  question: GBPQuestion
  onAnswer: (questionName: string, text: string) => Promise<void>
}) {
  const [answerText, setAnswerText] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const merchantAnswer = question.topAnswers?.find(a => a.author.type === 'MERCHANT')

  const handleSubmit = async () => {
    if (!answerText.trim()) return
    setSubmitting(true)
    try {
      await onAnswer(question.name, answerText)
      setAnswerText('')
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  const applyFAQ = (text: string) => setAnswerText(text)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
      {/* Question */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">Q</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{question.text}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-400">{question.author.displayName}</span>
            <span className="text-xs text-gray-400">{new Date(question.createTime).toLocaleDateString('en-IN')}</span>
            {question.upvoteCount > 0 && (
              <span className="text-xs text-blue-400">▲ {question.upvoteCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Existing merchant answer */}
      {merchantAnswer && (
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 ml-11 mb-3">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs font-semibold text-green-700">FETS Response</span>
            <span className="text-xs text-green-500">(Official)</span>
          </div>
          <p className="text-sm text-gray-700">{merchantAnswer.text}</p>
        </div>
      )}

      {/* Answer form */}
      {!merchantAnswer && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="ml-11 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          + Answer this question
        </button>
      )}

      {showForm && (
        <div className="ml-11">
          {/* FAQ quick picks */}
          <div className="flex flex-wrap gap-1 mb-2">
            {FETS_FAQ_TEMPLATES.map(faq => (
              <button
                key={faq.q}
                onClick={() => applyFAQ(faq.a)}
                title={faq.q}
                className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-100"
              >
                {faq.q}
              </button>
            ))}
          </div>
          <textarea
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            placeholder="Type your official answer as FETS..."
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !answerText.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post Answer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setAnswerText('') }}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BranchQA({ branch }: { branch: GBPBranch }) {
  const { questions, loading, error, answerQuestion } = useGBPQA(branch)
  const unanswered = questions.filter(q => !q.topAnswers?.some(a => a.author.type === 'MERCHANT')).length

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">{error}</div>
  )

  if (questions.length === 0) return (
    <div className="text-center py-8 text-gray-400 text-sm">No questions yet from candidates on Google Maps.</div>
  )

  return (
    <div>
      {unanswered > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <span className="text-amber-500">⚠️</span>
          <span className="text-sm text-amber-700 font-medium">{unanswered} unanswered question{unanswered > 1 ? 's' : ''} from candidates</span>
        </div>
      )}
      <div className="max-h-[500px] overflow-y-auto">
        {questions.map(q => (
          <QuestionCard key={q.name} question={q} onAnswer={answerQuestion} />
        ))}
      </div>
    </div>
  )
}

export function GBPQandA() {
  const [activeTab, setActiveTab] = useState<GBPBranch>('cochin')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Candidate Q&amp;A</h2>
          <p className="text-xs text-gray-400">Questions from Google Maps visitors</p>
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
      <BranchQA key={activeTab} branch={activeTab} />
    </div>
  )
}
