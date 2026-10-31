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
