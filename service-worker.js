/* ============================================================
 * 电子点名管理系统用户端 —— Service Worker（PWA 自动升级 + 离线缓存）
 * 作用：
 *  1. 预缓存核心资源（login.html / user.html / manifest / 图标 / config.js），
 *     页面首次在线加载后即可离线打开；
 *  2. 网络优先（network-first）：每次打开在线时自动从服务器拉取最新文件，
 *     实现「安装一次、永久自动升级」——无需用户重新下载安装；
 *  3. 离线时回退缓存（缓存中永远是最新一次在线版本）；
 *  4. 新版本安装后立即接管（skipWaiting / clients.claim），
 *     页面检测到接管后自动刷新，让新版立即生效。
 * 注意：Service Worker 仅在 HTTPS 或 localhost 下注册生效。
 * ============================================================ */
'use strict';

/* 缓存名：升级网页时改版本号即可整体刷新缓存 */
const CACHE = 'checkin-user-v10';

/* 预缓存清单（相对路径，必须与本文件同目录） */
const CORE = [
  './',
  './index.html',
  './login.html',
  './user.html',
  './manifest.json',
  './config.js',
  './logo.jpg',
  './icon-192.png',
  './icon-512.png'
];

/* 安装：写入核心缓存，并跳过等待立即生效 */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* 激活：清理旧版本缓存，并立即接管所有客户端 */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* 请求拦截：仅处理 GET；核心 HTML 走网络优先（自动升级），
   静态资源走缓存优先 + 后台回填（离线可用） */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  /* API 请求一律直连（不缓存），保证打卡上传/拉取实时性 */
  if (url.pathname.indexOf('/api/') === 0 || url.pathname === '/api/ping') return;

  const isNavigate = req.mode === 'navigate';
  const isCoreHtml = isNavigate || /\.html$/.test(url.pathname) || url.pathname === '/';

  if (isCoreHtml) {
    /* 网络优先：先试网络（拉最新版），失败回退缓存（离线可用） */
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });
      })
    );
    return;
  }

  /* 静态资源：缓存优先（快 + 离线），未命中则请求网络并回填缓存 */
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
