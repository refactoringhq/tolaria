import { expect, type Page, test } from '@playwright/test'
import { createFixtureVaultCopy, openFixtureVault, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

async function showAllNotesAsGraph(page: Page): Promise<void> {
  await page.getByTestId('sidebar-top-nav').getByText('All Notes', { exact: true }).click()
  await page.evaluate(() => localStorage.setItem('ff_graph_layout', 'true'))
  await page.getByTestId('layout-menu-button').click()
  await page.getByTestId('layout-option-graph').click()
  await expect(page.getByTestId('graph-layout')).toBeVisible({ timeout: 5_000 })
}

/** The centre of a node, read back from its label chip (the chip hangs just under the node). */
async function nodePoint(page: Page, title: string): Promise<{ x: number; y: number }> {
  const label = page.getByTestId('graph-label').filter({ hasText: title }).first()
  await expect(label).toBeVisible()
  const box = await label.boundingBox()
  if (!box) throw new Error(`No label for ${title}`)
  return { x: box.x + box.width / 2, y: box.y - 8 }
}

test.describe('Graph layout', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'WebGL canvas checks run in Chromium')
    tempVaultDir = createFixtureVaultCopy()
    await openFixtureVault(page, tempVaultDir)
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('draws the list as a graph and opens a clicked node in the right panel', async ({ page }) => {
    await showAllNotesAsGraph(page)
    const graph = page.getByTestId('graph-layout')
    await expect(graph).toHaveAttribute('data-node-count', /[1-9]/)
    await expect(page.getByTestId('kanban-panel-close')).toHaveCount(0)

    await page.waitForTimeout(1_500)
    const point = await nodePoint(page, 'Alpha Project')
    await page.mouse.click(point.x, point.y)
    await expect(page.getByTestId('kanban-panel-close')).toBeVisible()
    await expect(page.locator('[data-testid="graph-label"][data-selected="true"]')).toContainText('Alpha Project')

    const stage = await page.getByTestId('graph-stage').boundingBox()
    if (!stage) throw new Error('No graph stage')
    await page.mouse.click(stage.x + 8, stage.y + 8)
    await expect(page.getByTestId('kanban-panel-close')).toHaveCount(0)
  })
})
