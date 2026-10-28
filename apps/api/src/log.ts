// Structured JSON logs, one object per line, so the host can search and alert on fields.
// Never log raw coordinates, query text, or anything that identifies a user (roadmap phase 8).

type Level = 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

export interface Logger {
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
}

function write(level: Level, msg: string, fields: LogFields = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields })
  if (level === 'error') console.error(line)
  else console.log(line)
}

export const jsonLogger: Logger = {
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
}

export const silentLogger: Logger = { info() {}, warn() {}, error() {} }
