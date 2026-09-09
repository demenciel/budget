import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
);
type NavigationEvent = {
  request: { url: string; method: string; mode: string };
  respondWith: (value: Promise<Response>) => void;
};
function worker(network: typeof fetch) {
  const handlers: Record<string, (event: NavigationEvent) => void> = {};
  runInNewContext(source, {
    self: {
      location: { origin: 'https://budget.test' },
      addEventListener: (
        name: string,
        handler: (event: NavigationEvent) => void,
      ) => {
        handlers[name] = handler;
      },
    },
    URL,
    Response,
    fetch: network,
    // Any accidental financial caching fails these tests immediately.
    get caches() {
      throw new Error('Offline caching is forbidden');
    },
  });
  return (path: string, method = 'GET', mode = 'navigate') => {
    let response: Promise<Response> | undefined;
    handlers.fetch({
      request: { url: `https://budget.test${path}`, method, mode },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    return response;
  };
}
void test('PWA manifest has standalone identity and valid phone PNG sizes', () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL('../public/manifest.webmanifest', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  for (const icon of [
    ...manifest.icons,
    { src: '/icons/apple-touch-icon.png', sizes: '180x180' },
  ]) {
    const png = readFileSync(new URL(`../public${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});
void test('worker leaves APIs, writes and authentication untouched', () => {
  const dispatch = worker(async () => {
    throw new Error('must not intercept');
  });
  for (const path of [
    '/api/notebook',
    '/signin-with-chatgpt',
    '/signout-with-chatgpt',
    '/manifest.webmanifest',
  ])
    assert.equal(dispatch(path), undefined);
  assert.equal(dispatch('/', 'POST'), undefined);
  assert.equal(dispatch('/', 'GET', 'cors'), undefined);
});
void test('worker uses live uncached navigation and passes HTTP errors through', async () => {
  const response = new Response('server response', { status: 401 });
  const dispatch = worker(async (_request, options) => {
    assert.equal(options?.cache, 'no-store');
    return response;
  });
  assert.equal(await dispatch('/'), response);
});
void test('failed navigation offers generic offline message without financial data', async () => {
  const dispatch = worker(async () => {
    throw new TypeError('Offline');
  });
  const response = await dispatch('/');
  assert.equal(response?.status, 503);
  assert.equal(response?.headers.get('cache-control'), 'no-store');
  assert.match(await response!.text(), /A moment to reconnect/);
});
