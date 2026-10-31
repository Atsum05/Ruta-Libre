// Prints the coverage totals and the least-covered files as Markdown, for the CI job summary:
//   node scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"
// Reads coverage/coverage-summary.json, written by `pnpm test` (json-summary reporter).

import { readFileSync } from 'node:fs'

const summary = JSON.parse(
  readFileSync(new URL('../coverage/coverage-summary.json', import.meta.url), 'utf8'),
)
const metrics = ['lines', 'statements', 'functions', 'branches']
const pct = (m) => `${m.pct.toFixed(1)}%`
const relative = (file) => file.replace(/\\/g, '/').replace(/^.*?\/(apps|packages)\//, '$1/')

const lines = [
  '## Test coverage',
  '',
  `| ${metrics.join(' | ')} |`,
  `| ${metrics.map(() => '---').join(' | ')} |`,
]
lines.push(`| ${metrics.map((m) => pct(summary.total[m])).join(' | ')} |`, '')

const weakest = Object.entries(summary)
  .filter(([file]) => file !== 'total')
  .map(([file, m]) => ({ file: relative(file), branches: m.branches.pct, lines: m.lines.pct }))
  .filter((f) => f.branches < 100 || f.lines < 100)
  .sort((a, b) => a.branches - b.branches || a.lines - b.lines)
  .slice(0, 8)

if (weakest.length > 0) {
  lines.push(
    '<details><summary>Least-covered files</summary>',
    '',
    '| File | Branches | Lines |',
    '| --- | --- | --- |',
  )
  for (const f of weakest)
    lines.push(`| \`${f.file}\` | ${f.branches.toFixed(1)}% | ${f.lines.toFixed(1)}% |`)
  lines.push('', '</details>')
}
console.log(lines.join('\n'))
