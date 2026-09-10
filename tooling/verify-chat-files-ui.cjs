// Uses isolated API fixtures. Point PLAYWRIGHT_MODULE to an external installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.UI_CHECK_BASE_URL || 'http://127.0.0.1:3000';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA3cAAAAASUVORK5CYII=', 'base64');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const errors = [], uploaded = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    const conversation = { id: 'chat-fixture', title: 'Analisis lampiran', activeConnectionId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const files = [
      { id: 'json', originalName: 'data.json', contentType: 'application/json', sizeBytes: 20, status: 'ready', messageId: 'msg1' },
      { id: 'zip', originalName: 'project (1).zip', contentType: 'application/zip', sizeBytes: 200, status: 'ready', messageId: 'msg1' },
      { id: 'image', originalName: 'gambar.png', contentType: 'image/png', sizeBytes: png.length, status: 'ready', messageId: 'msg1' },
    ];
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      let body = {};
      if (path === '/api/auth/me') body = { profile: { id: 'fixture', username: 'demo', displayName: 'Demo' } };
      else if (path === '/api/preferences') body = { preferences: { theme: 'light', compactEnabled: true, compactThreshold: 80 } };
      else if (path === '/api/attachments/files/image') return route.fulfill({ body: png, contentType: 'image/png' });
      else if (path.endsWith('/content')) {
        body = path.includes('/zip/') && !url.searchParams.has('entryPath')
          ? { kind: 'archive', entries: [{ name: 'project/src/data.json', sizeBytes: 20, directory: false }], nextOffset: null }
          : { kind: 'text', content: '{"status":"berhasil dibaca"}', nextOffset: null };
      } else if (path === '/api/attachments/chat-fixture/files') {
        if (request.method() === 'POST') {
          const index = uploaded.length;
          const name = request.postDataBuffer().toString().includes('one.json') ? 'one.json' : 'two.md';
          uploaded.push(name);
          await new Promise(resolve => setTimeout(resolve, index === 0 ? 350 : 50));
          body = { attachment: { id: `new-${index}`, originalName: name, contentType: 'text/plain', sizeBytes: 2, status: 'ready', contentKind: 'text' } };
        } else body = { attachments: files };
      } else if (path.endsWith('/messages')) body = { messages: [{ id: 'msg1', role: 'user', content: { text: 'Analisa kedua file itu', attachments: [] }, seq: 1, status: 'completed', createdAt: new Date().toISOString() }] };
      else if (path.endsWith('/activities')) body = { events: [] };
      else if (path.includes('compaction')) body = { jobs: [] };
      else if (path.endsWith('/runs')) body = { runs: [] };
      else if (path === '/api/conversations/chat-fixture') body = { conversation };
      else if (path === '/api/conversations') body = { conversations: [conversation] };
      else if (path.includes('ai-provider')) body = { providers: [] };
      else if (path.includes('integrations')) body = { integrations: [] };
      else if (path.includes('connectors')) body = { connectors: [] };
      else if (path.includes('notifications')) body = { notifications: [], unreadCount: 0 };
      await route.fulfill({ json: body });
    });
    await page.goto(`${base}/chat/chat-fixture`);
    await page.locator('input[type=file]').setInputFiles([
      { name: 'one.json', mimeType: 'application/json;charset=utf-8', buffer: Buffer.from('{}') },
      { name: 'two.md', mimeType: 'text/markdown', buffer: Buffer.from('## Two') },
    ]);
    await page.getByText('one.json', { exact: true }).waitFor();
    await page.getByText('two.md', { exact: true }).waitFor();
    assert.equal(uploaded.length, 2);
    await page.getByRole('button', { name: 'Menu percakapan', exact: true }).click();
    await page.getByRole('menuitem', { name: 'View files in chat', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'File dalam percakapan' });
    await panel.getByText('3 file', { exact: true }).waitFor();
    await panel.getByRole('button', { name: /data.json/ }).click();
    await panel.getByText('{"status":"berhasil dibaca"}', { exact: true }).waitFor();
    await panel.getByRole('button', { name: /project \(1\).zip/ }).click();
    await panel.getByRole('button', { name: 'project/src/data.json', exact: true }).click();
    await panel.getByText('{"status":"berhasil dibaca"}', { exact: true }).waitFor();
    await panel.getByLabel('Cari file dalam chat').fill('gambar');
    await panel.getByRole('button', { name: /gambar.png/ }).click();
    await panel.getByRole('img', { name: 'gambar.png', exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth), false);
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > window.innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('Chat files UI passed: concurrent uploads, header menu, list, search, JSON/ZIP/image preview, mobile layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
