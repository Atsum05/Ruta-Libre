import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { ConfigError, parseConfig } from './config.ts'

function loadConfig() {
  try {
    return parseConfig(process.env)
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Refusing to start: invalid configuration\n${err.message}`)
      process.exit(1)
    }
    throw err
  }
}

const config = loadConfig()

const server = serve({ fetch: createApp(config).fetch, port: config.port }, (info) => {
  console.log(`api listening on :${info.port} (${config.env}, commit ${config.commit})`)
})

// Hosts stop instances with SIGTERM; finish in-flight requests before exiting.
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
