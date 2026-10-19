import { APIRequestContext, APIResponse, expect, request } from '@playwright/test';
import { routes } from './routes';

const API_URL = process.env.API_URL!;

export class Api {
  constructor(private ctx: APIRequestContext, readonly token?: string) {}

  private h(): Record<string, string> { return this.token ? { Authorization: `Bearer ${this.token}` } : {}; }
  get(url: string): Promise<APIResponse> { return this.ctx.get(url, { headers: this.h() }); }
  post(url: string, data?: unknown) { return this.ctx.post(url, { headers: this.h(), data }); }
  patch(url: string, data?: unknown) { return this.ctx.patch(url, { headers: this.h(), data }); }
  del(url: string) { return this.ctx.delete(url, { headers: this.h() }); }
}

export async function anonymous(): Promise<Api> {
  return new Api(await request.newContext({ baseURL: API_URL }));
}

export async function login(email: string, password: string): Promise<Api> {
  const ctx = await request.newContext({ baseURL: API_URL });
  const res = await ctx.post(routes.login, { data: { email, password } });
  expect(res.ok(), `login failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const token = body.accessToken; // confirmed: TokenResponseDto
  expect(token, 'accessToken missing in login response').toBeTruthy();
  return new Api(ctx, token);
}

export const owner = () => login(process.env.OWNER_EMAIL!, process.env.OWNER_PASSWORD!);
export const viewer = () => login(process.env.VIEWER_EMAIL!, process.env.VIEWER_PASSWORD!);

/** Tolerates [..] or {items|data: [..]} list shapes. */
export const asList = (b: any): any[] => (Array.isArray(b) ? b : b?.items ?? b?.data ?? []);

export const uniq = (p: string) => `${p}-qa-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

/** Room id: OWNER_ROOM_ID from .env if set, else the first room from GET /data-rooms (assumed). */
export async function roomId(api: Api): Promise<string> {
  if (process.env.OWNER_ROOM_ID) return process.env.OWNER_ROOM_ID;
  const rooms = asList(await (await api.get(routes.rooms)).json());
  const id = rooms[0]?.id;
  expect(id, 'cannot determine room id - set OWNER_ROOM_ID in .env').toBeTruthy();
  return id;
}

/** Creates a folder in the owner's room. Caller must clean up. */
export async function createFolder(api: Api, name: string, parentId: string | null = null) {
  const rid = await roomId(api);
  const res = await api.post(routes.folders, { name, dataRoomId: rid, ...(parentId ? { parentId } : {}) });
  return { roomId: rid, res };
}
