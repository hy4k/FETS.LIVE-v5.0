import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X, Plus, Copy, Trash2, Pencil, Check, LayoutGrid } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export type QuickAccessClientSlug = 'prometric' | 'pearson' | 'psi' | 'celpip' | 'itts' | 'fets'

export type QuickAccessFieldType =
  | 'url'
  | 'login_id'
  | 'password'
  | 'email'
  | 'contact_phone'
  | 'site_code'
  | 'access_code'
  | 'api_key'
  | 'support_pin'
  | 'notes'
  | 'other'

export type QuickAccessItemRow = {
  id: string
  owner_id: string
  client_slug: QuickAccessClientSlug
  field_type: QuickAccessFieldType
  value_text: string
  label: string | null
  sort_order: number
  source_vault_row_id: string | null
  created_at: string
  updated_at: string
}

const FIELD_OPTIONS: { id: QuickAccessFieldType; label: string }[] = [
  { id: 'url', label: 'URL' },
  { id: 'login_id', label: 'Login / ID' },
  { id: 'password', label: 'Password' },
  { id: 'email', label: 'Email' },
  { id: 'contact_phone', label: 'Contact number' },
  { id: 'site_code', label: 'Site code' },
  { id: 'access_code', label: 'Access code' },
  { id: 'api_key', label: 'API key' },
  { id: 'support_pin', label: 'Support PIN' },
  { id: 'notes', label: 'Notes / other text' },
  { id: 'other', label: 'Other' },
]

const CLIENTS: { slug: QuickAccessClientSlug; name: string; image?: string }[] = [
  { slug: 'prometric', name: 'Prometric', image: '/live-support/prometric.png' },
  { slug: 'pearson', name: 'Pearson Vue', image: '/live-support/pearson-vue.png' },
  { slug: 'psi', name: 'PSI', image: '/live-support/psi.png' },
  { slug: 'celpip', name: 'CELPIP', image: '/live-support/celpip.png' },
  { slug: 'itts', name: 'ITTS', image: '/live-support/itts.png' },
  { slug: 'fets', name: 'FETS' },
]

function inferClientSlug(v: Record<string, unknown>): QuickAccessClientSlug {
  const blob = `${v.category ?? ''} ${v.title ?? ''} ${v.notes ?? ''} ${v.type ?? ''} ${v.content ?? ''}`
    .toLowerCase()
  if (blob.includes('prometric')) return 'prometric'
  if (blob.includes('pearson') || blob.includes('vue')) return 'pearson'
  if (blob.includes('celpip')) return 'celpip'
  if (blob.includes('psi')) return 'psi'
  if (blob.includes('itts') || blob.includes('surpass')) return 'itts'
  return 'fets'
}

function fieldLabel(t: string) {
  return FIELD_OPTIONS.find((f) => f.id === t)?.label ?? t
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copied`, {
    style: {
      background: '#121214',
      color: '#FACC15',
      border: '1px solid rgba(250, 204, 21, 0.2)',
      fontSize: '10px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
  })
}

export function QuickAccessSection({
  profile,
  authUserId,
}: {
  profile: { id: string } | null | undefined
  /** Supabase auth user id — vault rows may reference either staff_profiles.id or auth uid */
  authUserId?: string | null
}) {
  const [items, setItems] = useState<QuickAccessItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [migrationDone, setMigrationDone] = useState(false)
  const [activeClient, setActiveClient] = useState<QuickAccessClientSlug | null>(null)
  const [collapsed, setCollapsed] = useState(true)

  const [addFieldType, setAddFieldType] = useState<QuickAccessFieldType>('url')
  const [addValue, setAddValue] = useState('')
  const [addLabel, setAddLabel] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editLabel, setEditLabel] = useState('')

  const fetchItems = useCallback(async () => {
    if (!profile?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('quick_access_items')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        setTableMissing(true)
        setItems([])
      } else {
        console.error('quick_access_items', error)
        toast.error(error.message)
      }
      setLoading(false)
      return
    }
    setTableMissing(false)
    setItems((data || []) as QuickAccessItemRow[])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  /** One-time migration from fets_vault: split rows into typed items; skip vault rows already imported */
  useEffect(() => {
    if (!profile?.id || tableMissing || migrationDone) return

    let cancelled = false
    ;(async () => {
      const { data: existingTags } = await supabase
        .from('quick_access_items')
        .select('source_vault_row_id')
        .not('source_vault_row_id', 'is', null)

      const migratedVaultIds = new Set(
        (existingTags || []).map((r: { source_vault_row_id: string }) => r.source_vault_row_id).filter(Boolean)
      )

      const { data: vaultRows, error: vErr } = await supabase.from('fets_vault').select('*')
      if (vErr || !vaultRows?.length) {
        setMigrationDone(true)
        return
      }

      const toInsert: Record<string, unknown>[] = []
      for (const v of vaultRows as Record<string, unknown>[]) {
        const vid = v.id as string | undefined
        if (!vid || migratedVaultIds.has(vid)) continue

        const rowOwner = v.user_id as string | undefined
        const isMine =
          rowOwner &&
          (rowOwner === profile.id || (authUserId && rowOwner === authUserId))
        if (!isMine) continue

        const client = inferClientSlug(v)
        const rowLabel = (v.title as string) || null

        const push = (field_type: QuickAccessFieldType, val: unknown) => {
          if (val == null) return
          const s = String(val).trim()
          if (!s) return
          toInsert.push({
            owner_id: v.user_id,
            client_slug: client,
            field_type,
            value_text: s,
            label: rowLabel,
            sort_order: 0,
            source_vault_row_id: vid,
          })
        }

        push('url', v.url)
        push('login_id', v.username)
        push('password', v.password)
        push('email', v.prof_email)
        push('contact_phone', v.contact_numbers)
        push('site_code', v.site_id)
        push('password', v.prof_email_password)
        const notes = (v.notes as string) || (v.content as string)
        push('notes', notes)
        if (v.other_urls) {
          push('notes', typeof v.other_urls === 'string' ? v.other_urls : JSON.stringify(v.other_urls))
        }
      }

      if (cancelled || toInsert.length === 0) {
        setMigrationDone(true)
        return
      }

      const { error: insErr } = await supabase.from('quick_access_items').insert(toInsert)
      if (insErr) {
        console.error('Quick access migration', insErr)
      } else {
        await fetchItems()
      }
      setMigrationDone(true)
    })()

    return () => {
      cancelled = true
    }
  }, [profile?.id, authUserId, tableMissing, migrationDone, fetchItems])

  const byClient = useMemo(() => {
    const m = new Map<QuickAccessClientSlug, QuickAccessItemRow[]>()
    CLIENTS.forEach((c) => m.set(c.slug, []))
    for (const it of items) {
      const list = m.get(it.client_slug) || []
      list.push(it)
      m.set(it.client_slug, list)
    }
    return m
  }, [items])

  const activeItems = activeClient ? byClient.get(activeClient) || [] : []

  const groupedForModal = useMemo(() => {
    const m = new Map<string, QuickAccessItemRow[]>()
    for (const o of FIELD_OPTIONS) m.set(o.id, [])
    for (const row of activeItems) {
      const list = m.get(row.field_type)
      if (list) list.push(row)
    }
    return FIELD_OPTIONS.map((o) => ({ opt: o, rows: m.get(o.id) || [] })).filter((g) => g.rows.length > 0)
  }, [activeItems])

  const resetAdd = () => {
    setAddFieldType('url')
    setAddValue('')
    setAddLabel('')
  }

  const handleAdd = async () => {
    if (!profile?.id || !activeClient) return
    const v = addValue.trim()
    if (!v) {
      toast.error('Enter a value')
      return
    }
    const { error } = await supabase.from('quick_access_items').insert({
      owner_id: profile.id,
      client_slug: activeClient,
      field_type: addFieldType,
      value_text: v,
      label: addLabel.trim() || null,
      sort_order: activeItems.length,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Saved')
    resetAdd()
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('quick_access_items').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Removed')
    if (editingId === id) {
      setEditingId(null)
    }
    fetchItems()
  }

  const startEdit = (row: QuickAccessItemRow) => {
    setEditingId(row.id)
    setEditValue(row.value_text)
    setEditLabel(row.label || '')
  }

  const saveEdit = async () => {
    if (!editingId || !profile?.id) return
    const v = editValue.trim()
    if (!v) {
      toast.error('Value required')
      return
    }
    const { error } = await supabase
      .from('quick_access_items')
      .update({
        value_text: v,
        label: editLabel.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Updated')
    setEditingId(null)
    fetchItems()
  }

  const activeMeta = CLIENTS.find((c) => c.slug === activeClient)

  const inputForField = (
    fieldType: QuickAccessFieldType,
    value: string,
    onChange: (v: string) => void,
    id: string
  ) => {
    if (fieldType === 'notes') {
      return (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60 resize-none"
        />
      )
    }
    const type =
      fieldType === 'password'
        ? 'password'
        : fieldType === 'email'
          ? 'email'
          : fieldType === 'contact_phone'
            ? 'tel'
            : fieldType === 'url'
              ? 'url'
              : 'text'
    return (
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60"
      />
    )
  }

  if (!profile?.id) {
    return null
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-12"
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between gap-4 border-b border-white/5 pb-4 group text-left rounded-sm hover:bg-white/[0.02] transition-colors -mx-1 px-1"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-sm bg-[#FACC15]/10 flex items-center justify-center border border-[#FACC15]/20 shrink-0">
              <LayoutGrid size={16} className="text-[#FACC15]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-white tracking-tighter uppercase group-hover:text-[#FACC15] transition-colors leading-none">
                Quick Access
              </h3>
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold mt-1.5 truncate">
                {collapsed
                  ? 'Vendor shortcuts & credentials — tap to expand'
                  : `${items.length} saved item${items.length === 1 ? '' : 's'} · ${CLIENTS.length} groups`}
              </p>
            </div>
          </div>
          <ChevronDown
            size={20}
            className={`shrink-0 text-[#FACC15]/60 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
            aria-hidden
          />
        </button>

        {tableMissing && (
          <p className="text-xs text-amber-400/90 mt-3 px-1 leading-relaxed">
            Run the SQL migration <code className="text-[10px] bg-white/5 px-1 rounded">supabase/migrations/20260404120000_quick_access_items.sql</code> in the
            Supabase SQL editor to enable Quick Access storage.
          </p>
        )}

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-3">
                {CLIENTS.map((c) => {
                  const count = byClient.get(c.slug)?.length ?? 0
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => setActiveClient(c.slug)}
                      className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl min-h-[96px] md:min-h-[100px] px-2 py-3
                        border border-white/[0.12] bg-white/[0.06] backdrop-blur-xl
                        shadow-[8px_10px_22px_rgba(0,0,0,0.42),-6px_-6px_16px_rgba(39,87,91,0.15),inset_0_1px_0_rgba(255,255,255,0.14)]
                        transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FACC15]/35 hover:bg-white/[0.1]
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FACC15]/45"
                    >
                      <span
                        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.12] via-transparent to-[#1a3a3d]/40 opacity-70 group-hover:opacity-90"
                        aria-hidden
                      />
                      {c.image ? (
                        <div className="relative z-[1] w-full max-w-[120px] h-9 md:h-10 flex items-center justify-center">
                          <img
                            src={c.image}
                            alt={c.name}
                            className="max-h-full max-w-full object-contain opacity-95"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="relative z-[1] w-14 h-14 rounded-2xl bg-[#FACC15]/15 border border-[#FACC15]/35 flex items-center justify-center">
                          <span className="text-sm font-black text-[#FACC15] tracking-[0.2em]">FETS</span>
                        </div>
                      )}
                      <span className="relative z-[1] mt-1.5 text-[9px] font-bold text-white/45 uppercase tracking-widest">
                        {count} item{count === 1 ? '' : 's'}
                      </span>
                    </button>
                  )
                })}
              </div>
              {loading && <p className="text-xs text-white/40 mt-3">Loading…</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {activeClient && activeMeta && (
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="quick-access-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setActiveClient(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg max-h-[85vh] flex flex-col bg-[#121214]/98 border border-[#FACC15]/25 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 bg-gradient-to-r from-[#FACC15]/10 to-transparent">
                <div className="flex items-center gap-3 min-w-0">
                  {activeMeta.image ? (
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 p-1">
                      <img src={activeMeta.image} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-[#FACC15] tracking-widest">FETS</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 id="quick-access-title" className="text-sm font-black text-white uppercase tracking-wide truncate">
                      {activeMeta.name}
                    </h2>
                    <p className="text-[9px] text-[#FACC15]/60 uppercase tracking-widest mt-0.5">Quick Access</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveClient(null)
                    resetAdd()
                    setEditingId(null)
                  }}
                  className="shrink-0 w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {activeItems.length === 0 && (
                  <p className="text-xs text-white/40 text-center py-6">No saved items yet. Add one below.</p>
                )}

                {groupedForModal.map(({ opt, rows }) => (
                  <div key={opt.id} className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35 border-b border-white/[0.06] pb-1.5">
                      {opt.label}
                    </h4>
                    {rows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-white/70 truncate max-w-[55%]">
                        {row.label || 'Entry'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {editingId === row.id ? (
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="p-1.5 rounded-lg bg-[#FACC15]/20 text-[#FACC15] hover:bg-[#FACC15]/30"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:text-[#FACC15]"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400/90 hover:bg-red-500/20"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(row.value_text, fieldLabel(row.field_type))}
                          className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-[#FACC15]"
                          title="Copy"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                    {editingId === row.id ? (
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase font-bold text-white/40">Optional label</label>
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                        <label className="text-[9px] uppercase font-bold text-white/40">Value</label>
                        {inputForField(row.field_type as QuickAccessFieldType, editValue, setEditValue, `edit-${row.id}`)}
                      </div>
                    ) : (
                      <p className="text-xs text-white/90 break-words font-medium whitespace-pre-wrap">
                        {row.field_type === 'password' ? '••••••••' : row.value_text}
                      </p>
                    )}
                  </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 p-4 bg-black/50 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#FACC15]/70 flex items-center gap-2">
                  <Plus size={12} /> Add entry
                </p>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-white/40">Type</label>
                  <select
                    value={addFieldType}
                    onChange={(e) => setAddFieldType(e.target.value as QuickAccessFieldType)}
                    className="w-full bg-black/40 border border-[#FACC15]/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FACC15]/60"
                  >
                    {FIELD_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-white/40">Optional label</label>
                  <input
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    placeholder="e.g. Main portal"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/25"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-white/40">Value</label>
                  {inputForField(addFieldType, addValue, setAddValue, 'add-value')}
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="w-full py-2.5 rounded-xl bg-[#FACC15] text-[#121214] font-bold text-[10px] uppercase tracking-widest hover:brightness-110"
                >
                  Save to {activeMeta.name}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
