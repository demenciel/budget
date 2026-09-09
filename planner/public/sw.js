/* No Cache Storage or offline financial records. All requests go to the server. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Leave APIs, authentication and assets on the normal network path.
  if (
    event.request.method !== 'GET' ||
    event.request.mode !== 'navigate' ||
    url.origin !== self.location.origin ||
    url.pathname !== '/'
  )
    return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(
      () =>
        new Response(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#315d48"><title>Together · Offline</title><style>body{background:#f8f9f5;color:#263d30;font:18px/1.6 system-ui;margin:0;padding:12vh 24px}main{max-width:420px;margin:auto}h1{font-family:Georgia,serif}a{color:#315d48}</style><main><h1>A moment to reconnect.</h1><p>Together needs an internet connection to show your latest budget and save changes.</p><p>No financial information is stored for offline use.</p><a href="/">Try again</a></main></html>`,
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
              'Content-Security-Policy':
                "default-src 'none'; style-src 'unsafe-inline'",
            },
          },
        ),
    ),
  );
});
