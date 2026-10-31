import { expect, test } from '@playwright/test'
import { axeViolations, mockApi, PLANS, pick, STATUS } from './mock-api.ts'

// The main flows from roadmap phase 7: a clean trip, a rerouted trip, a no-alternative trip,
// and the degraded-status state. Each runs on a phone and a desktop viewport.

async function planTrip(page: import('@playwright/test').Page) {
  await pick(page, 'Desde', 'Univ', /Universidad de Chile/)
  await pick(page, 'Hasta', 'Toes', /Toesca/)
  await page.getByRole('button', { name: 'Buscar ruta accesible' }).click()
}

test('plans a clean trip', async ({ page }) => {
  await mockApi(page, { plan: PLANS.clean })
  await page.goto('/')
  await expect(page.getByText('Estado de ascensores actualizado hace 10 min.')).toBeVisible()
  await planTrip(page)

  await expect(
    page.getByRole('status').filter({ hasText: 'Ruta accesible encontrada.' }),
  ).toBeVisible()
  const card = page.getByRole('article')
  await expect(card.getByText('Accesible ahora')).toBeVisible()
  await expect(card.getByText('Línea 1 dirección San Pablo')).toBeVisible()
  await expect(card.getByText('Caminar ~5 min a tu ritmo')).toBeVisible()
  await page.screenshot({
    path: `test-results/clean-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('explains a rerouted trip and keeps the blocked one for reference', async ({ page }) => {
  await mockApi(page, { plan: PLANS.rerouted })
  await page.goto('/')
  await planTrip(page)

  await expect(page.getByText(/Ruta ajustada/)).toBeVisible()
  await expect(
    page.getByRole('article').first().getByText('Micro 210 hacia Gran Avenida'),
  ).toBeVisible()
  await page.getByText('Otras opciones (1)').click()
  await expect(
    page.getByText('Ascensor fuera de servicio en Los Héroes, en tu andén.'),
  ).toBeVisible()
  await expect(page.getByText('No accesible')).toBeVisible()
  await page.screenshot({
    path: `test-results/rerouted-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('lets the rider choose another option and go back to the recommended one', async ({
  page,
}) => {
  await mockApi(page, { plan: PLANS.rerouted })
  await page.goto('/')
  await planTrip(page)

  await page.getByText('Otras opciones (1)').click()
  await page.getByRole('button', { name: 'Ver esta ruta' }).click()
  const main = page.getByRole('article').first()
  await expect(main.getByText('No accesible')).toBeVisible()
  await expect(main.getByRole('heading', { level: 3 })).toBeFocused()
  await expect(page.getByText('Estás viendo otra opción.')).toBeVisible()
  expect(await axeViolations(page)).toEqual([])
  await page.screenshot({
    path: `test-results/chosen-${test.info().project.name}.png`,
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Volver a la recomendada' }).click()
  await expect(main.getByText('Micro 210 hacia Gran Avenida')).toBeVisible()
})

test('tells the person to ask for assistance when nothing is accessible', async ({ page }) => {
  await mockApi(page, { plan: PLANS.noAlternative })
  await page.goto('/')
  await planTrip(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Pide asistencia' })).toBeVisible()
})

test('warns prominently when the status data is stale', async ({ page }) => {
  await mockApi(page, { status: STATUS.stale })
  await page.goto('/')
  await expect(
    page.getByRole('alert').filter({ hasText: 'no se actualizan desde hace 11 días' }),
  ).toBeVisible()
  await page.screenshot({
    path: `test-results/stale-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('falls back gracefully when the map cannot load', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await expect(
    page.getByText('El mapa no está disponible. La búsqueda de rutas sigue funcionando.'),
  ).toBeVisible()
})

test('switches to English', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('button', { name: 'Find accessible route' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('can be used with the keyboard alone', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Desde' }).focus()
  await page.keyboard.type('Univ')
  await expect(page.getByRole('option', { name: /Universidad de Chile/ })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Desde' })).toHaveValue(
    'Universidad de Chile, Santiago',
  )
})

test('fits a phone screen without sideways scrolling', async ({ page }) => {
  await mockApi(page, { plan: PLANS.rerouted })
  await page.goto('/')
  await planTrip(page)
  await expect(page.getByText(/Ruta ajustada/)).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('meets WCAG 2.2 AA on the start page and the results, including contrast', async ({
  page,
}) => {
  await mockApi(page, { plan: PLANS.rerouted, status: STATUS.stale })
  await page.goto('/')
  expect(await axeViolations(page)).toEqual([])
  await planTrip(page)
  await page.getByText('Otras opciones (1)').click()
  expect(await axeViolations(page)).toEqual([])
})

/** Gives the page a speech recogniser that "hears" a phrase, or fails with a browser error. */
async function fakeSpeech(
  page: import('@playwright/test').Page,
  outcome: { heard: string } | { error: string },
) {
  await page.addInitScript((o) => {
    class FakeRecognition {
      lang = ''
      interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: ((e: unknown) => void) | null = null
      onend: (() => void) | null = null
      start() {
        setTimeout(() => {
          if ('heard' in o) {
            const words = o.heard.split(' ')
            words.forEach((_, i) => {
              this.onresult?.({ results: [[{ transcript: words.slice(0, i + 1).join(' ') }]] })
            })
          } else {
            this.onerror?.({ error: o.error })
          }
          this.onend?.()
        }, 50)
      }
      stop() {
        this.onend?.()
      }
    }
    ;(window as unknown as Record<string, unknown>)['SpeechRecognition'] = FakeRecognition
  }, outcome)
}

test('plans a trip from dictation', async ({ page }) => {
  await fakeSpeech(page, { heard: 'de la Universidad de Chile a Toesca' })
  await mockApi(page, { plan: PLANS.clean })
  await page.goto('/')
  await page.getByRole('button', { name: 'Dictar por voz' }).click()
  await expect(page.getByLabel('O describe tu viaje')).toHaveValue(
    'de la Universidad de Chile a Toesca',
  )
  await expect(
    page.getByRole('status').filter({ hasText: 'Ruta accesible encontrada.' }),
  ).toBeVisible()
  // The form folds into a summary once there's a result; it shows what was understood.
  await expect(page.getByRole('region', { name: 'Tu viaje' })).toContainText('Universidad de Chile')
  await expect(page.getByRole('region', { name: 'Tu viaje' })).toContainText('Toesca')
})

test('explains why dictation failed instead of doing nothing', async ({ page }) => {
  await fakeSpeech(page, { error: 'not-allowed' })
  await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Dictar por voz' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'permite el uso del micrófono' }),
  ).toBeVisible()
})

test('labels demo mode clearly, on the status and on each route', async ({ page }) => {
  await mockApi(page, { status: STATUS.demo, plan: PLANS.demo })
  await page.goto('/')
  await expect(page.getByRole('note').filter({ hasText: 'Modo demo' })).toContainText(
    '16 de octubre',
  )
  await planTrip(page)
  await expect(page.getByRole('article').getByText('Demo', { exact: true })).toBeVisible()
  await page.screenshot({
    path: `test-results/demo-${test.info().project.name}.png`,
    fullPage: true,
  })
})
