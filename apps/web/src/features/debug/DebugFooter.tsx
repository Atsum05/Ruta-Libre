import { useEffect, useState } from 'react'
import { fetchHealth, type Health } from '../../shared/health.ts'

type ApiState = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'error' }

// Shows which web and API builds are live, so a deploy can be confirmed at a glance.
export function DebugFooter() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchHealth(fetch, controller.signal)
      .then((health) => setApi({ kind: 'ok', health }))
      .catch(() => {
        if (!controller.signal.aborted) setApi({ kind: 'error' })
      })
    return () => controller.abort()
  }, [])

  return (
    <footer className="debug-footer">
      web {__APP_VERSION__} ({__APP_COMMIT__}) · {describeApi(api)}
    </footer>
  )
}

function describeApi(api: ApiState): string {
  switch (api.kind) {
    case 'loading':
      return 'api …'
    case 'error':
      return 'api no disponible'
    case 'ok':
      return `api ${api.health.version} (${api.health.commit}, ${api.health.env})`
  }
}
