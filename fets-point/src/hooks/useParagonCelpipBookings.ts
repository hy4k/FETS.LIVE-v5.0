import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type ParagonCelpipBookingRow = {
  branch_location: string
  slot_key: string
  exam_date: string
  start_time: string
  test_type: string
  booked_count: number
  capacity: number
  source: string
  updated_at: string
}

const fetchParagonCelpipBookings = async (args: {
  isGlobalView: boolean
  branchLocation: string | null
}): Promise<ParagonCelpipBookingRow[]> => {
  const sb = supabase as any
  let q = sb
    .from('paragon_celpip_bookings')
    .select('branch_location,slot_key,exam_date,start_time,test_type,booked_count,capacity,source,updated_at')
    .order('branch_location', { ascending: true })
    .order('exam_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (!args.isGlobalView) {
    if (!args.branchLocation || args.branchLocation === 'global') {
      return []
    }
    q = q.eq('branch_location', args.branchLocation)
  }

  const { data, error } = await q

  if (error) throw new Error(error.message)
  return (data as ParagonCelpipBookingRow[]) ?? []
}

export const useParagonCelpipBookings = (enabled: boolean, isGlobalView: boolean, branchLocation: string | null) => {
  return useQuery<ParagonCelpipBookingRow[], Error>({
    queryKey: ['paragon', 'celpip', 'bookings', { isGlobalView, branchLocation }],
    queryFn: () => fetchParagonCelpipBookings({ isGlobalView, branchLocation }),
    enabled,
    staleTime: 60_000,
    refetchInterval: 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 3,
  })
}
