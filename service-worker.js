/* ============================================================
 * 打卡系统用户端 —— Service Worker（PWA 离线缓存）
 *
 * 作用：
 *  1. 预缓存核心资源（user.html / login.html / manifest / 图标），
 *     页面首次在线加载后即可离线打开；
 *  2. 运行期缓存优先（cache-first）+ 网络回填：命中缓存直接返回，
 *     未命中则请求网络并顺手入缓存；
 *  3. 新版本安装后立即接管（skipWaiting / clients.claim），
 *     便于 PWABuilder 等工具检测 manifest + SW 达标。
 *
 * 注意：Service Worker 仅在 HTTPS 或 localhost 下注册生效；
 * 打包 APK 前需把本目录部署到可公网访问的 HTTPS 站点。
 * ============================================================ */
'use strict';

/* 缓存名：升级网页时改版本号即可整体刷新缓存 */
const CACHE = 'checkin-user-v1';

/* 预缓存清单（相对路径，必须与本文件同目录） */
const CORE = [
  './',
  './login.html',
  './user.html',
  './manifest.json',
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

/* 请求拦截：仅处理 GET；缓存优先，未命中再请求网络并回填 */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;                      // 命中缓存：直接返回（离线可用）
      return fetch(req).then(function (res) {
        // 仅缓存同源成功响应，避免污染缓存
        if (res && res.ok && req.url.indexOf(self.location.origin) === 0) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });    // 网络失败且无缓存：原样失败
    })
  );
});
