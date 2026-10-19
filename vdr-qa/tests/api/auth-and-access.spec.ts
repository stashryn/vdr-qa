import { test, expect } from '@playwright/test';
import { anonymous, owner, viewer, createFolder, uniq } from '../../fixtures/api-client';
import { routes } from '../../fixtures/routes';

const OWNER = () => process.env.OWNER_EMAIL!;

test.describe('Health & authentication', () => {
  test('API is alive', async () => {
    expect((await (await anonymous()).get(routes.health)).status()).toBe(200);
  });

  test('valid login returns accessToken; /auth/me returns profile', async () => {
    const o = await owner();
    const res = await o.get(routes.me);
    expect(res.status()).toBe(200);
    expect((await res.json()).email).toBe(OWNER().toLowerCase());
  });

  test('wrong password and unknown email give the same 401 (no user enumeration)', async () => {
    const a = await anonymous();
    const bad = await a.post(routes.login, { email: OWNER(), password: 'wrong-password' });
    const unknown = await a.post(routes.login, { email: `nobody-${Date.now()}@example.com`, password: 'wrong-password' });
    expect(bad.status()).toBe(401);
    expect(unknown.status()).toBe(401);
    expect((await bad.json()).message).toEqual((await unknown.json()).message);
  });

  test('malformed email -> 400', async () => {
    expect((await (await anonymous()).post(routes.login, { email: 'nope', password: 'x' })).status()).toBe(400);
  });

  test('register: duplicate email -> 409 (case-insensitive)', async () => {
    const res = await (await anonymous()).post(routes.register, { name: 'QA', email: OWNER().toUpperCase(), password: 'longenough1' });
    expect(res.status()).toBe(409);
  });

  test('register: short password -> 400', async () => {
    const res = await (await anonymous()).post(routes.register, { name: 'QA', email: `short-${Date.now()}@example.com`, password: '123' });
    expect(res.status()).toBe(400);
  });

  test('protected endpoints reject missing / garbage token with 401', async () => {
    const a = await anonymous();
    expect((await a.get(routes.me)).status()).toBe(401);
    const { request } = await import('@playwright/test');
    const ctx = await request.newContext({ baseURL: process.env.API_URL, extraHTTPHeaders: { Authorization: 'Bearer garbage.token.value' } });
    expect((await ctx.get(routes.me)).status()).toBe(401);
  });
});

test.describe('Authorization on folders (data leak = critical)', () => {
  test('viewer gets 404 on read, breadcrumbs, preview, rename, delete of owner folder', async () => {
    const o = await owner(); const v = await viewer();
    const { res } = await createFolder(o, uniq('private'));
    expect(res.status()).toBe(201);
    const f = await res.json();
    try {
      expect((await v.get(routes.folderContents(f.id))).status()).toBe(404);
      expect((await v.get(routes.folderBreadcrumbs(f.id))).status()).toBe(404);
      expect((await v.get(routes.folderDeletePreview(f.id))).status()).toBe(404);
      expect((await v.patch(routes.folder(f.id), { name: 'hacked' })).status()).toBe(404);
      expect((await v.del(routes.folder(f.id))).status()).toBe(404);
      // folder must be intact
      expect((await o.get(routes.folderContents(f.id))).status()).toBe(200);
    } finally { await o.del(routes.folder(f.id)); }
  });

  test('anonymous cannot read folder contents', async () => {
    const o = await owner();
    const { res } = await createFolder(o, uniq('anon'));
    const f = await res.json();
    try { expect((await (await anonymous()).get(routes.folderContents(f.id))).status()).toBe(401); }
    finally { await o.del(routes.folder(f.id)); }
  });
});

test.describe('Folders: validation, conflicts, delete', () => {
  for (const [label, name] of [['empty', ''], ['whitespace only', '   '], ['over 200 chars', 'a'.repeat(201)]] as const) {
    test(`create rejects name: ${label} -> 400`, async () => {
      const { res } = await createFolder(await owner(), name);
      expect(res.status()).toBe(400);
    });
  }

  test('non-UUID id -> 400 on contents', async () => {
    expect((await (await owner()).get(routes.folderContents('not-a-uuid'))).status()).toBe(400);
  });

  test('duplicate name -> 409, ignoring case and surrounding whitespace', async () => {
    const o = await owner(); const name = uniq('dup');
    const first = await createFolder(o, name);
    const f = await first.res.json();
    try {
      expect(first.res.status()).toBe(201);
      expect((await createFolder(o, name)).res.status()).toBe(409);
      expect((await createFolder(o, name.toUpperCase())).res.status()).toBe(409);
      expect((await createFolder(o, `  ${name}  `)).res.status()).toBe(409);
    } finally { await o.del(routes.folder(f.id)); }
  });

  test('rename to a sibling name -> 409', async () => {
    const o = await owner(); const a = uniq('a'); const b = uniq('b');
    const fa = await (await createFolder(o, a)).res.json();
    const fb = await (await createFolder(o, b)).res.json();
    try { expect((await o.patch(routes.folder(fb.id), { name: a.toUpperCase() })).status()).toBe(409); }
    finally { await o.del(routes.folder(fa.id)); await o.del(routes.folder(fb.id)); }
  });

  test('nested folder: breadcrumbs, delete-preview counts, cascade delete (204)', async () => {
    const o = await owner();
    const parent = await (await createFolder(o, uniq('parent'))).res.json();
    const child = await (await createFolder(o, uniq('child'), parent.id)).res.json();
    expect((await o.get(routes.folderBreadcrumbs(child.id))).status()).toBe(200);
    const bc = await (await o.get(routes.folderBreadcrumbs(child.id))).json();
    expect(bc.folders.map((x: any) => x.id)).toEqual([parent.id, child.id]);
    expect(bc.accessLevel).toBe('OWNER');

    const prev = await (await o.get(routes.folderDeletePreview(parent.id))).json();
    expect(prev).toMatchObject({ folderCount: 1, fileCount: 0, totalSize: 0 });

    expect((await o.del(routes.folder(parent.id))).status()).toBe(204);
    expect((await o.get(routes.folderContents(child.id))).status()).toBe(404); // cascade
  });
});
