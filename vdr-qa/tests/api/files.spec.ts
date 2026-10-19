import { test, expect } from '@playwright/test';
import { anonymous, owner, viewer, roomId, createFolder, uniq } from '../../fixtures/api-client';
import { routes } from '../../fixtures/routes';

const MB = 1024 * 1024;
const intent = async (api: any, over: Record<string, unknown> = {}) =>
  api.post(routes.uploadIntent, { dataRoomId: await roomId(await owner()), name: `${uniq('f')}.pdf`, size: 1024, mimeType: 'application/pdf', ...over });

test.describe('Upload intent: validation (no bytes are uploaded)', () => {
  for (const [label, over] of [
    ['non-PDF mime type', { mimeType: 'image/png' }],
    ['over 50 MB', { size: 50 * MB + 1 }],
    ['zero size', { size: 0 }],
    ['empty name', { name: '   ' }],
    ['name over 255 chars', { name: 'a'.repeat(256) + '.pdf' }],
    ['non-integer size', { size: 10.5 }],
  ] as const) {
    test(`rejects ${label} -> 400`, async () => {
      expect((await intent(await owner(), over)).status()).toBe(400);
    });
  }

  test('anonymous -> 401', async () => {
    expect((await (await anonymous()).post(routes.uploadIntent, { name: 'a.pdf' })).status()).toBe(401);
  });

  test("viewer cannot upload into owner's room (404)", async () => {
    const rid = await roomId(await owner());
    expect((await (await viewer()).post(routes.uploadIntent, { dataRoomId: rid, name: 'x.pdf', size: 10, mimeType: 'application/pdf' })).status()).toBe(404);
  });

  test('unknown folderId -> 404', async () => {
    expect((await intent(await owner(), { folderId: '00000000-0000-4000-8000-000000000000' })).status()).toBe(404);
  });
});

test.describe('Upload lifecycle: pending files stay invisible', () => {
  test('intent returns fileId+uploadUrl; file hidden until /complete; /complete without bytes -> 400', async () => {
    const o = await owner();
    const folder = await (await createFolder(o, uniq('up'))).res.json();
    let fileId: string | undefined;
    try {
      const res = await intent(o, { folderId: folder.id });
      expect(res.status()).toBe(201);
      const body = await res.json();
      fileId = body.fileId;
      expect(body.uploadUrl).toMatch(/^https:\/\//);

      const contents = JSON.stringify(await (await o.get(routes.folderContents(folder.id))).json());
      expect(contents).not.toContain(fileId!);
      expect((await o.get(routes.file(fileId!))).status()).toBe(404);          // "not fully uploaded yet"
      expect((await o.get(routes.fileViewUrl(fileId!))).status()).toBe(404);
      expect((await o.post(routes.fileComplete(fileId!))).status()).toBe(400);  // object not in storage
    } finally {
      if (fileId) await o.del(routes.file(fileId));
      await o.del(routes.folder(folder.id));
    }
  });

  test('non-UUID file id -> 400', async () => {
    expect((await (await owner()).get(routes.file('nope'))).status()).toBe(400);
  });
});
