/* ============================================================
 * 打卡系统 —— Service Worker（PWA 基础实现）
 *
 * 满足 PWABuilder 检测与页面离线访问：
 *  1. install：预缓存核心页面（login.html / user.html / manifest / icon）
 *  2. fetch：缓存优先 + 网络回填（未命中再请求网络并入缓存）
 *  3. activate：清理旧版本缓存，立即接管页面
 *
 * 全部相对路径，无外网资源。
 * ============================================================ */
'use strict';

/* 缓存名：网页更新后改版本号即可整体刷新缓存 */
var CACHE = 'checkin-pwa-v1';

/* 预缓存清单（与本文件同目录） */
var CORE = [
  './',
  './login.html',
  './user.html',
  './manifest.json',
  './icon.png'
];

/* 安装：写入核心缓存，并跳过等待立即生效 */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* 激活：清理旧缓存并接管所有客户端 */
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

/* 请求拦截：GET 请求缓存优先；未命中再请求网络并回填缓存 */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;                      // 命中缓存：直接返回（离线可用）
      return fetch(req).then(function (res) {
        /* 仅缓存同源成功响应（不同源指后端 API 等，不缓存） */
        if (res && res.ok && req.url.indexOf(self.location.origin) === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });    // 网络失败且无缓存：原样失败
    })
  );
});
