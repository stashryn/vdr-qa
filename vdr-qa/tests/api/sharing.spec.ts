import { test, expect } from '@playwright/test';
import { anonymous, owner, viewer, createFolder, asList, uniq } from '../../fixtures/api-client';
import { routes } from '../../fixtures/routes';

const VIEWER_EMAIL = () => process.env.VIEWER_EMAIL!;
const shareUser = (o: any, folderId: string) =>
  o.post(routes.shares, { resourceType: 'FOLDER', resourceId: folderId, mode: 'USER', granteeEmail: VIEWER_EMAIL() });

test.describe('Sharing: validation & ownership', () => {
  test('USER share without granteeEmail -> 400; unknown resourceType -> 400', async () => {
    const o = await owner();
    const f = await (await createFolder(o, uniq('val'))).res.json();
    try {
      expect((await o.post(routes.shares, { resourceType: 'FOLDER', resourceId: f.id, mode: 'USER' })).status()).toBe(400);
      expect((await o.post(routes.shares, { resourceType: 'NOPE', resourceId: f.id, mode: 'USER', granteeEmail: 'a@b.co' })).status()).toBe(400);
    } finally { await o.del(routes.folder(f.id)); }
  });

  test('viewer cannot share, or list shares of, a resource they do not own (404)', async () => {
    const o = await owner(); const v = await viewer();
    const f = await (await createFolder(o, uniq('own'))).res.json();
    try {
      expect((await v.post(routes.shares, { resourceType: 'FOLDER', resourceId: f.id, mode: 'PUBLIC_LINK' })).status()).toBe(404);
      expect((await v.get(`${routes.shares}?resourceType=FOLDER&resourceId=${f.id}`)).status()).toBe(404);
    } finally { await o.del(routes.folder(f.id)); }
  });

  test('creating the same share twice is idempotent (same id)', async () => {
    const o = await owner();
    const f = await (await createFolder(o, uniq('idem'))).res.json();
    try {
      const a = await (await shareUser(o, f.id)).json();
      const b = await (await shareUser(o, f.id)).json();
      expect(b.id).toBe(a.id);
      await o.del(routes.share(a.id));
    } finally { await o.del(routes.folder(f.id)); }
  });
});

test.describe('Sharing: per-user access & revocation (core business risk)', () => {
  test('grantee gets read-only access; revoke removes it immediately', async () => {
    const o = await owner(); const v = await viewer();
    const f = await (await createFolder(o, uniq('shared'))).res.json();
    try {
      expect((await v.get(routes.folderContents(f.id))).status()).toBe(404);

      const res = await shareUser(o, f.id);
      expect(res.status()).toBe(201);
      const share = await res.json();
      expect(share.token).toBeNull();
      expect(share.granteeEmail).toBe(VIEWER_EMAIL().toLowerCase());

      expect((await v.get(routes.folderContents(f.id))).status()).toBe(200);
      const received = asList(await (await v.get(routes.sharesReceived)).json());
      expect(received.some((r: any) => r.resourceId === f.id)).toBeTruthy();

      // read-only
      expect((await v.patch(routes.folder(f.id), { name: 'x' })).status()).toBe(404);
      expect((await v.del(routes.folder(f.id))).status()).toBe(404);
      expect((await v.post(routes.shares, { resourceType: 'FOLDER', resourceId: f.id, mode: 'PUBLIC_LINK' })).status()).toBe(404);

      expect((await o.del(routes.share(share.id))).status()).toBe(204);
      expect((await v.get(routes.folderContents(f.id))).status()).toBe(404);
      const after = asList(await (await v.get(routes.sharesReceived)).json());
      expect(after.some((r: any) => r.resourceId === f.id)).toBeFalsy();
    } finally { await o.del(routes.folder(f.id)); }
  });

  test('share inherits to nested + later-added content; breadcrumbs never reveal names above the share (past regression)', async () => {
    const o = await owner(); const v = await viewer();
    const top = await (await createFolder(o, uniq('SECRET-top'))).res.json();
    const shared = await (await createFolder(o, uniq('shared-mid'), top.id)).res.json();
    const child = await (await createFolder(o, uniq('child'), shared.id)).res.json();
    let shareId: string | undefined;
    try {
      shareId = (await (await shareUser(o, shared.id)).json()).id;
      // nested folder readable
      expect((await v.get(routes.folderContents(child.id))).status()).toBe(200);
      // folder created AFTER sharing is readable too
      const later = await (await createFolder(o, uniq('later'), shared.id)).res.json();
      expect((await v.get(routes.folderContents(later.id))).status()).toBe(200);
      // parent above the boundary is NOT readable
      expect((await v.get(routes.folderContents(top.id))).status()).toBe(404);

      const bc = await (await v.get(routes.folderBreadcrumbs(child.id))).json();
      expect(bc.folders.map((x: any) => x.id)).toEqual([shared.id, child.id]);
      expect(bc.dataRoomName).toBeNull();
      expect(bc.accessLevel).toBe('VIEWER');
      expect(JSON.stringify(bc)).not.toContain(top.name);
    } finally {
      if (shareId) await o.del(routes.share(shareId));
      await o.del(routes.folder(top.id));
    }
  });

  test('owner deletes a folder the grantee is viewing -> grantee gets 404, share is skipped in /received (edge case from task)', async () => {
    const o = await owner(); const v = await viewer();
    const f = await (await createFolder(o, uniq('vanish'))).res.json();
    await shareUser(o, f.id);
    expect((await v.get(routes.folderContents(f.id))).status()).toBe(200);
    expect((await o.del(routes.folder(f.id))).status()).toBe(204);
    expect((await v.get(routes.folderContents(f.id))).status()).toBe(404);
    const received = asList(await (await v.get(routes.sharesReceived)).json());
    expect(received.some((r: any) => r.resourceId === f.id)).toBeFalsy();
  });
});

test.describe('Sharing: public link', () => {
  test('PUBLIC_LINK returns a token; listing shows it; revoke -> 204', async () => {
    const o = await owner();
    const f = await (await createFolder(o, uniq('public'))).res.json();
    try {
      const res = await o.post(routes.shares, { resourceType: 'FOLDER', resourceId: f.id, mode: 'PUBLIC_LINK' });
      expect(res.status()).toBe(201);
      const share = await res.json();
      expect(share.token).toBeTruthy();
      expect(share.granteeEmail).toBeNull();
      const list = asList(await (await o.get(`${routes.shares}?resourceType=FOLDER&resourceId=${f.id}`)).json());
      expect(list.some((s: any) => s.id === share.id)).toBeTruthy();
      expect((await o.del(routes.share(share.id))).status()).toBe(204);
      const after = asList(await (await o.get(`${routes.shares}?resourceType=FOLDER&resourceId=${f.id}`)).json());
      expect(after.some((s: any) => s.id === share.id)).toBeFalsy();
    } finally { await o.del(routes.folder(f.id)); }
  });

  // ASSUMED path: confirm `/public/{token}/...` in the public controller.
  test('revoked public link answers 410 Gone (spec says so)', async () => {
    const o = await owner();
    const f = await (await createFolder(o, uniq('gone'))).res.json();
    try {
      const share = await (await o.post(routes.shares, { resourceType: 'FOLDER', resourceId: f.id, mode: 'PUBLIC_LINK' })).json();
      await o.del(routes.share(share.id));
      expect((await (await anonymous()).get(routes.publicView(share.token))).status()).toBe(410);
    } finally { await o.del(routes.folder(f.id)); }
  });

  test('unknown public token does not 500', async () => {
    const s = (await (await anonymous()).get(routes.publicView('definitely-not-a-token'))).status();
    expect(s).toBeLessThan(500);
  });
});
