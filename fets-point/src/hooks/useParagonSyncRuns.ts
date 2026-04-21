import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type ParagonSyncDayChange = { date: string; change: number }

export type ParagonSyncDetails = {
  total_candidates_after?: number
  additional_candidates_since_last_update?: number
  test_days_with_changes?: ParagonSyncDayChange[]
}

export type ParagonSyncRunRow = {
  id: number
  branch_location: string | null
  ok: boolean
  message: string | null
  slot_count: number
  created_at: string
  sync_details?: ParagonSyncDetails | null
}

const fetchParagonSyncRuns = async (args: {
  isGlobalView: boolean
  branchLocation: string | null
}): Promise<ParagonSyncRunRow[]> => {
  const sb = supabase as any
  let q = sb
    .from('paragon_schedule_sync_runs')
    .select('id,branch_location,ok,message,slot_count,created_at,sync_details')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!args.isGlobalView) {
    if (!args.branchLocation || args.branchLocation === 'global') {
      return []
    }
    q = q.eq('branch_location', args.branchLocation)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data as ParagonSyncRunRow[]) ?? []
}

export const useParagonSyncRuns = (enabled: boolean, isGlobalView: boolean, branchLocation: string | null) => {
  return useQuery<ParagonSyncRunRow[], Error>({
    queryKey: ['paragon', 'celpip', 'sync-runs', { isGlobalView, branchLocation }],
    queryFn: () => fetchParagonSyncRuns({ isGlobalView, branchLocation }),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 3,
  })
}
