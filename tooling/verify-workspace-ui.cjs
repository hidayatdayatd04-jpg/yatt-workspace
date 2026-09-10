// Visual smoke test using isolated fixtures. Install Playwright outside the project,
// then set PLAYWRIGHT_MODULE to its module path, or install it in the test environment.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.UI_CHECK_OUTPUT || path.join(process.env.TEMP || '/tmp', 'agent-workspace-ui');
const baseUrl = process.env.UI_CHECK_BASE_URL || 'http://127.0.0.1:3000';
fs.mkdirSync(output, { recursive: true });
const states = ['mikrotik','workspace','drive','gmail','calendar','telegram'].map(kind => ({ kind, enabled: ['mikrotik','workspace'].includes(kind), configured: ['mikrotik','workspace'].includes(kind), allowWrite: false, allowSend: false, allowShell: false, status: ['mikrotik','workspace'].includes(kind) ? 'ready' : 'disabled', lastCheckedAt: null, lastError: null }));
const preferences = { theme: 'light', sidebarCollapsed: false, compactEnabled: true, compactThreshold: 80, aiInstructions: '' };
const profile = { id: 'fixture', username: 'workspace', displayName: 'Demo Workspace', loginAlias: 'demo' };
const errors = [];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()); let body = {};
      if (url.pathname === '/api/auth/me') body = { profile };
      else if (url.pathname === '/api/preferences') { if (req.method() === 'PATCH') Object.assign(preferences, req.postDataJSON()); body = { preferences }; }
      else if (url.pathname === '/api/integrations') body = { integrations: states, shellAvailable: false };
      else if (url.pathname === '/api/integrations/google/status') body = { account: { connected: true, email: 'fixture@example.test', scopes: [], enabled: true, expiryMs: null }, services: {} };
      else if (url.pathname === '/api/custom-connectors') body = { connectors: [] };
      else if (url.pathname.startsWith('/api/integrations/')) { const state = states.find(s => s.kind === url.pathname.split('/')[3]); if (state && req.method() === 'PUT') { const { credentials, ...rest } = req.postDataJSON(); Object.assign(state, rest); if (credentials && Object.values(credentials).some(Boolean)) state.configured = true; } body = { integration: state }; }
      else if (url.pathname === '/api/ai-provider') body = { providers: [] };
      else if (url.pathname === '/api/connectors') body = { connectors: [] };
      else if (url.pathname === '/api/conversations') body = { conversations: [] };
      else if (url.pathname === '/api/memories') body = { memories: [] };
      else if (url.pathname.includes('/monitoring/settings/watcher')) body = { watcherEnabled: false, intervalMs: 180000 };
      else if (url.pathname.includes('vision-settings') || url.pathname.includes('web-search-settings')) body = { configured: false };
      else if (url.pathname.includes('notifications')) body = { notifications: [], unreadCount: 0 };
      else if (url.pathname.includes('rate-limit')) body = { buckets: [], blockedModels: [], checkpoints: [] };
      await route.fulfill({ json: body });
    });
    await page.route('**/health/**', route => route.fulfill({ json: { status: 'ok', checks: { database: 'ok' } } }));
    for (const section of ['providers','appearance','memory','context','profile','security','archive','monitoring','web-search','about','help']) {
      await page.goto(`${baseUrl}/settings/${section}`);
      await page.getByRole('navigation', { name: 'Pengaturan' }).waitFor();
      await page.waitForTimeout(250);
      if (await page.locator('body').evaluate(el => el.scrollWidth > window.innerWidth)) throw new Error(`Desktop overflow: ${section}`);
      if (['providers','appearance'].includes(section)) await page.screenshot({ path: path.join(output, `${section}-desktop.png`), fullPage: true });
    }
    await page.goto(`${baseUrl}/connectors`);
    await page.getByRole('heading', { name: 'Connectors', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Google Drive', exact: true }).waitFor();
    if (await page.locator('tbody tr').count() !== 4) throw new Error('Expected four visible connectors');
    await page.screenshot({ path: path.join(output, 'connectors-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Gmail', exact: true }).click();
    await page.getByRole('switch', { name: 'Buat draft email' }).click();
    await page.getByRole('button', { name: 'Simpan izin' }).click();
    await page.getByText('Gmail diaktifkan.', { exact: true }).waitFor();
    if (!states.find(s => s.kind === 'gmail').allowWrite) throw new Error('Connector permissions were not persisted');
    await page.goto(`${baseUrl}/chat`);
    await page.getByRole('button', { name: 'Tambah lampiran dan connectors' }).click();
    await page.getByRole('menuitem', { name: /Connectors/ }).waitFor();
    await page.screenshot({ path: path.join(output, 'composer-desktop.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ['/connectors','/settings/providers','/settings/appearance','/settings/security']) {
      await page.goto(`${baseUrl}${url}`); await page.waitForTimeout(400);
      if (await page.locator('body').evaluate(el => el.scrollWidth > window.innerWidth)) throw new Error(`Mobile overflow: ${url}`);
      await page.screenshot({ path: path.join(output, `${url.split('/').pop()}-mobile.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/settings/appearance`);
    await page.getByRole('button', { name: 'Gelap', exact: true }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(output, 'appearance-dark.png'), fullPage: true });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ passed: true, settingsPages: 11, connectors: 4, mobileLayouts: 4, screenshots: output }));
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
