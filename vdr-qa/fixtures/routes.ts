/**
 * Auth + Folders routes are CONFIRMED from the API controllers.
 * Rooms / Files / Shares are still ASSUMED - confirm and fix here.
 */
export const routes = {
  health: '/health',                                   // confirmed (README)
  register: '/auth/register',                          // confirmed
  login: '/auth/login',                                // confirmed
  me: '/auth/me',                                      // confirmed
  folders: '/folders',                                 // confirmed (POST)
  folder: (id: string) => `/folders/${id}`,            // confirmed (PATCH, DELETE -> 204)
  folderContents: (id: string) => `/folders/${id}/contents`,           // confirmed
  folderBreadcrumbs: (id: string) => `/folders/${id}/breadcrumbs`,     // confirmed
  folderDeletePreview: (id: string) => `/folders/${id}/delete-preview`, // confirmed
  shares: '/shares',                                   // confirmed (POST, GET ?resourceType&resourceId)
  sharesReceived: '/shares/received',                  // confirmed
  share: (id: string) => `/shares/${id}`,              // confirmed (DELETE -> 204)
  uploadIntent: '/files/upload-intent',                // confirmed
  fileComplete: (id: string) => `/files/${id}/complete`, // confirmed
  file: (id: string) => `/files/${id}`,                // confirmed (GET, PATCH, DELETE)
  fileViewUrl: (id: string) => `/files/${id}/view-url`,
  rooms: '/data-rooms',                                // ASSUMED list route; or set OWNER_ROOM_ID in .env
  room: (id: string) => `/data-rooms/${id}`,           // confirmed to exist (GET)
  publicView: (token: string) => `/public/${token}`,   // ASSUMED: /public/{token}/... exists, exact paths unknown
};
