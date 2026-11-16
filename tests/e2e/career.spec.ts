import { expect, test } from '@playwright/test';

test.describe('FOOTBALL TYCOON Full Career Journey', () => {
  test('creates 2014/15 career, manages squad, tactics, transfers, live match, standings, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // 1. Open FOOTBALL TYCOON
    await page.goto('/');
    await expect(page.getByText('FOOTBALL TYCOON').first()).toBeVisible();

    // 2. Start new career
    await page.getByRole('button', { name: /New Career/i }).first().click();

    // 3. Select 2014/15
    await page.getByTestId('season-card-2014/15').click();
    await page.getByRole('button', { name: /Continue to Competition/i }).click();

    // Competition step (English Premier League selected by default)
    await page.getByTestId('league-card-epl').click();
    await page.getByRole('button', { name: /Continue to Club Selection/i }).click();

    // 4. Select an available club
    await page.getByTestId('club-card-chelsea').click();
    await page.getByRole('button', { name: /Continue to Manager Profile/i }).click();

    // 5. Create manager
    await page.locator('#mgr-name').fill('Jose Vance');
    await page.getByRole('button', { name: /Review Career Summary/i }).click();
    await page.getByRole('button', { name: /Confirm & Start Career/i }).click();

    // 6. Enter dashboard
    await expect(page.getByRole('heading', { name: 'Chelsea FC' })).toBeVisible();

    // 7. View squad
    const isMobile = (page.viewportSize()?.width ?? 1440) < 1024;
    const assertNoOverflow = async () => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    };
    await assertNoOverflow();

    if (isMobile) {
      await page.getByRole('navigation', { name: 'Mobile bottom navigation' }).getByRole('button', { name: 'Squad' }).click();
    } else {
      await page.locator('#nav-squad').click();
    }
    await expect(page.getByRole('heading', { name: 'Squad Management' })).toBeVisible();
    await assertNoOverflow();

    // 8. Open player profile & customize Blue Skill 1 and Purple Skill 2
    await page.getByText('Eden Hazard').first().click();
    await expect(page.getByRole('heading', { name: 'Eden Hazard' })).toBeVisible();
    await page.getByLabel('Select Skill 1 (Blue)').selectOption('creativity');
    await page.getByLabel('Select Skill 2 (Purple)').selectOption('free_kicks');
    await expect(
      page.getByLabel('Select Skill 2 (Purple)').locator('option[value="creativity"]')
    ).toBeDisabled();
    await assertNoOverflow();

    // 8b. Visit Club -> Youth Academy and promote an original Academy graduate
    if (isMobile) {
      await page.getByRole('button', { name: 'Toggle menu' }).click();
      await page.getByRole('button', { name: 'Club', exact: true }).click();
    } else {
      await page.locator('#nav-club').click();
    }
    await page.getByRole('button', { name: 'Youth Academy' }).click();
    await page.locator('#acad-name').fill('Marcus Sterling-Vale');
    await page.getByLabel('Academy Skill 1 (Blue)').selectOption('passing');
    await page.getByLabel('Academy Skill 2 (Purple)').selectOption('intelligence');
    await page.getByRole('button', { name: /Promote to First Team/i }).click();
    await expect(page.getByRole('heading', { name: 'Marcus Sterling-Vale' })).toBeVisible();
    await assertNoOverflow();

    // 9. Change formation & 10. Save tactics
    if (isMobile) {
      await page.getByRole('navigation', { name: 'Mobile bottom navigation' }).getByRole('button', { name: 'Tactics' }).click();
    } else {
      await page.locator('#nav-tactics').click();
    }
    await expect(page.getByRole('heading', { name: 'Tactical Editor' })).toBeVisible();
    await page.getByRole('button', { name: '4-2-3-1' }).click();
    await page.getByRole('button', { name: /Auto-Pick Best XI/i }).click();
    await page.getByRole('button', { name: /Save Tactics/i }).click();
    await assertNoOverflow();

    // 11. Search transfer market & 12. Complete a valid transfer
    if (isMobile) {
      await page.getByRole('button', { name: 'Toggle menu' }).click();
      await page.getByRole('button', { name: 'Transfers' }).click();
    } else {
      await page.locator('#nav-transfers').click();
    }
    await expect(page.getByRole('heading', { name: 'Transfer Market' })).toBeVisible();
    await page.getByPlaceholder('Search player name or country...').fill('Carlos Vela');
    await page.getByRole('button', { name: 'Bid' }).first().click();
    await page.getByRole('button', { name: /Accept Asking/i }).click();
    await page.getByRole('button', { name: /Submit Personal Terms/i }).click();
    await page.getByRole('button', { name: /Complete Transfer/i }).click();
    await assertNoOverflow();

    // 13. Prepare match
    if (isMobile) {
      await page.getByRole('navigation', { name: 'Mobile bottom navigation' }).getByRole('button', { name: 'Match' }).click();
    } else {
      await page.getByRole('button', { name: /Matchday/i }).first().click();
    }
    await expect(page.getByRole('heading', { name: 'Match Preparation' })).toBeVisible();
    await page.getByRole('button', { name: 'Instant' }).click();

    // 14. Run live simulation
    await page.getByRole('button', { name: /Start Live Match/i }).click();
    await expect(page.getByRole('heading', { name: 'Live Match Commentary' })).toBeVisible();
    await page.getByRole('button', { name: /Start Second Half/i }).click();

    // 15. Finish match & 16. View match report
    await page.getByRole('button', { name: /Finish & View Match Report/i }).click();
    await expect(page.getByRole('heading', { name: 'Full-Time Match Report' })).toBeVisible();
    await assertNoOverflow();

    // 17. Verify standings & continental simplified format disclaimer & 18. Matchday advanced to MD 2
    await page.getByRole('button', { name: /View Standings/i }).click();
    await expect(page.getByRole('heading', { name: 'Competitions & Calendar' })).toBeVisible();
    await expect(page.getByText(/Matchday 2\/18/i)).toBeVisible();
    await page.getByRole('button', { name: 'UCL & UEL' }).click();
    await expect(page.getByText(/Simplified Continental Format/i)).toBeVisible();
    await assertNoOverflow();

    // 18b. Verify Finances
    if (isMobile) {
      await page.getByRole('button', { name: 'Toggle menu' }).click();
      await page.getByRole('button', { name: 'Finances' }).click();
    } else {
      await page.locator('#nav-finances').click();
    }
    await expect(page.getByRole('heading', { name: 'Financial Overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Transaction Ledger' })).toBeVisible();
    await assertNoOverflow();

    // 18c. Verify Save Manager
    if (isMobile) {
      await page.getByRole('button', { name: 'Toggle menu' }).click();
      await page.getByRole('button', { name: 'Career Saves' }).click();
    } else {
      await page.locator('#nav-saves').click();
    }
    await expect(page.getByRole('heading', { name: 'Career Saves' })).toBeVisible();
    await page.getByRole('button', { name: /Save Current Career/i }).click();
    await assertNoOverflow();

    // 19. Refresh browser & 20. Restore saved career and verify Academy graduate + customized skills persisted
    await page.reload();
    await expect(page.getByRole('button', { name: /Continue Career/i })).toBeVisible();
    await page.getByRole('button', { name: /Continue Career/i }).click();
    await expect(page.getByRole('heading', { name: 'Chelsea FC', exact: true })).toBeVisible();
    await expect(page.getByText(/MD 2\/18/i)).toBeVisible();

    if (isMobile) {
      await page.getByRole('navigation', { name: 'Mobile bottom navigation' }).getByRole('button', { name: 'Squad' }).click();
    } else {
      await page.locator('#nav-squad').click();
    }
    await expect(page.getByText('Marcus Sterling-Vale').first()).toBeVisible();
    await page.getByText('Eden Hazard').first().click();
    await expect(page.getByLabel('Select Skill 1 (Blue)')).toHaveValue('creativity');
    await expect(page.getByLabel('Select Skill 2 (Purple)')).toHaveValue('free_kicks');

    const layoutMetrics = await page.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const bottomNav = document.querySelector('nav[aria-label="Mobile bottom navigation"]');
      const bottomNavHeight = bottomNav ? bottomNav.getBoundingClientRect().height : 0;
      return {
        overflow,
        bottomNavHeight,
        viewportHeight: window.innerHeight,
      };
    });
    expect(layoutMetrics.overflow).toBeLessThanOrEqual(1);
    if (isMobile) {
      expect(layoutMetrics.bottomNavHeight).toBeGreaterThan(0);
      expect(layoutMetrics.bottomNavHeight).toBeLessThanOrEqual(layoutMetrics.viewportHeight * 0.15);
    }
    expect(errors).toEqual([]);
  });
});
