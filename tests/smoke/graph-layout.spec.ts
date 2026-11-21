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
  return { x: box.x + box.width / 2, y: box.y - 10 }
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

    const canvas = await page.getByTestId('graph-canvas').boundingBox()
    if (!canvas) throw new Error('No graph canvas')
    await page.mouse.click(canvas.x + 8, canvas.y + 8)
    await expect(page.getByTestId('kanban-panel-close')).toHaveCount(0)
  })

  test('drags a node without opening it, then focuses a clicked node until Escape', async ({ page }) => {
    await showAllNotesAsGraph(page)
    await page.waitForTimeout(2_500)
    const canvas = page.getByTestId('graph-canvas')
    const start = await nodePoint(page, 'Alpha Project')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    for (let step = 1; step <= 10; step += 1) await page.mouse.move(start.x + step * 12, start.y + step * 6)
    await page.mouse.up()
    await expect(page.getByTestId('kanban-panel-close')).toHaveCount(0)
    await expect(canvas).not.toHaveAttribute('data-focused-node', /.+/)
    const moved = await nodePoint(page, 'Alpha Project')
    expect(Math.hypot(moved.x - start.x, moved.y - start.y)).toBeGreaterThan(40)

    // Move off the node first: a hovered label may sit on another side of its node.
    const box = await canvas.boundingBox()
    if (!box) throw new Error('No graph canvas')
    await page.mouse.move(box.x + 8, box.y + 8)
    await page.waitForTimeout(2_500)
    const settled = await nodePoint(page, 'Alpha Project')
    await page.mouse.click(settled.x, settled.y)
    await expect(page.getByTestId('kanban-panel-close')).toBeVisible()
    await expect(canvas).toHaveAttribute('data-focused-node', /alpha-project\.md$/)
    await page.keyboard.press('Escape')
    await expect(canvas).not.toHaveAttribute('data-focused-node', /.+/)
  })
})
