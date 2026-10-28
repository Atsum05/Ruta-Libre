import { useQuery } from '@tanstack/react-query'
import { api } from '../../shared/api.ts'

// Shows which web and API builds are live, so a deploy can be confirmed at a glance.
export function DebugFooter() {
  const health = useQuery({ queryKey: ['health'], queryFn: ({ signal }) => api.health(signal) })
  const apiText = health.data
    ? `api ${health.data.version} (${health.data.commit}, ${health.data.env})`
    : health.isError
      ? 'api no disponible'
      : 'api …'
  return (
    <p className="debug-footer">
      web {__APP_VERSION__} ({__APP_COMMIT__}) · {apiText}
    </p>
  )
}
