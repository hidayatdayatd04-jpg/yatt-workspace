// Run against Vite with PLAYWRIGHT_MODULE pointing to an external Playwright install.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.UI_CHECK_BASE_URL || 'http://127.0.0.1:3000';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const providers = [];
  const saves = [];
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.route('**/api/**', async route => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      let body = {};
      if (pathname === '/api/auth/me') body = { profile: { id: 'fixture', username: 'workspace', displayName: 'Demo', email: null } };
      else if (pathname === '/api/preferences') body = { preferences: { theme: 'light', compactEnabled: true, compactThreshold: 80 } };
      else if (pathname === '/api/vision-settings/models') body = { models: [{ id: 'gpt-4o-mini' }], source: 'fixture' };
      else if (pathname === '/api/vision-settings') {
        if (req.method() === 'POST') {
          const input = req.postDataJSON(); saves.push(input);
          const { apiKey, ...safe } = input;
          const provider = { ...safe, hasKey: !!apiKey || providers.some(p => p.id === input.id), updatedAt: new Date().toISOString() };
          const index = providers.findIndex(p => p.id === input.id);
          if (index < 0) providers.push(provider); else providers[index] = provider;
          body = { provider };
        } else body = { providers };
      } else if (pathname.startsWith('/api/vision-settings/')) {
        const id = pathname.split('/')[3];
        const index = providers.findIndex(p => p.id === id);
        if (req.method() === 'DELETE') { providers.splice(index, 1); body = { ok: true }; }
        else { Object.assign(providers[index], req.postDataJSON()); body = { provider: providers[index] }; }
      } else if (pathname.includes('ai-provider')) body = { providers: [] };
      else if (pathname.includes('conversations')) body = { conversations: [] };
      else if (pathname.includes('integrations')) body = { integrations: [] };
      else if (pathname.includes('connectors')) body = { connectors: [] };
      else if (pathname.includes('notifications')) body = { notifications: [], unreadCount: 0 };
      await route.fulfill({ json: body });
    });
    await page.goto(`${base}/settings/vision`);
    await page.getByRole('button', { name: 'Tambah Provider Vision', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Konfigurasi Provider Vision', exact: true });
    await dialog.getByLabel('API key', { exact: false }).fill('fixture-api-key');
    await dialog.getByLabel('Tambah model manual', { exact: true }).fill('deepseek-chat');
    await dialog.getByRole('button', { name: 'Tambah Model', exact: true }).click();
    await page.getByText('Model "deepseek-chat" tidak mendukung gambar dan ditolak.', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('radio').count(), 1);
    await dialog.getByRole('button', { name: 'Tarik Model', exact: true }).click();
    await dialog.getByRole('button', { name: 'gpt-4o-mini + Tambah', exact: true }).click();
    await dialog.getByRole('radio', { name: 'gpt-4o-mini', exact: true }).check();
    await dialog.getByRole('button', { name: 'Simpan Konfigurasi', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(providers[0].models, ['gemini-2.0-flash', 'gpt-4o-mini']);
    assert.equal(providers[0].activeModel, 'gpt-4o-mini');
    await page.getByRole('button', { name: 'Konfigurasi', exact: true }).click();
    assert.equal(await dialog.getByLabel('API key', { exact: false }).inputValue(), '');
    await dialog.getByRole('button', { name: 'Simpan Konfigurasi', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(saves[1].apiKey, undefined);
    await page.getByRole('switch', { name: 'Aktifkan provider Google Gemini' }).click();
    await page.getByText('Nonaktif', { exact: true }).waitFor();
    assert.equal(providers[0].enabled, false);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > window.innerWidth), false);
    await page.getByRole('button', { name: 'Konfigurasi', exact: true }).click();
    assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await dialog.getByRole('button', { name: 'Batal', exact: true }).click();
    await page.getByRole('button', { name: 'Hapus', exact: true }).click();
    await page.getByText('Belum ada provider vision.', { exact: false }).waitFor();
    assert.equal(providers.length, 0);
    assert.deepEqual(errors, []);
    console.log('Vision UI passed: validation, remote models, save, retained key, toggle, delete, mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
