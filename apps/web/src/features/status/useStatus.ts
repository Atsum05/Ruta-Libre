import { useQuery } from '@tanstack/react-query'
import { api } from '../../shared/api.ts'

export const STATUS_REFETCH_MS = 60_000

/** Live elevator status, refreshed every minute (the prototype loaded it once: bug #3). */
export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api.status(signal),
    refetchInterval: STATUS_REFETCH_MS,
    refetchOnWindowFocus: true,
  })
}
