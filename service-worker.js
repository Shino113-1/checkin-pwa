/* ============================================================
 * 鐢靛瓙鐐瑰悕绠＄悊绯荤粺鐢ㄦ埛绔?鈥斺€?Service Worker锛圥WA 绂荤嚎缂撳瓨锛? * 浣滅敤锛? *  1. 棰勭紦瀛樻牳蹇冭祫婧愶紙login.html / user.html / manifest / 鍥炬爣 /
 *     config.js / 鏍囧織鍥撅級锛岄〉闈㈤娆″湪绾垮姞杞藉悗鍗冲彲绂荤嚎鎵撳紑锛? *  2. 杩愯鏈熺紦瀛樹紭鍏堬紙cache-first锛夛細鍛戒腑缂撳瓨鐩存帴杩斿洖锛? *     鏈懡涓垯璇锋眰缃戠粶骞堕『鎵嬪叆缂撳瓨锛? *  3. 鏂扮増鏈畨瑁呭悗绔嬪嵆鎺ョ锛坰kipWaiting / clients.claim锛夛紝
 *     渚夸簬 PWABuilder 绛夊伐鍏锋娴?manifest + SW 杈炬爣銆? * 娉ㄦ剰锛歋ervice Worker 浠呭湪 HTTPS 鎴?localhost 涓嬫敞鍐岀敓鏁堬紱
 * 鎵撳寘 APK 鍓嶉渶鎶婃湰鐩綍閮ㄧ讲鍒板彲鍏綉璁块棶鐨?HTTPS 绔欑偣銆? * ============================================================ */
'use strict';

/* 缂撳瓨鍚嶏細鍗囩骇缃戦〉鏃舵敼鐗堟湰鍙峰嵆鍙暣浣撳埛鏂扮紦瀛?*/
const CACHE = 'checkin-user-v8';

/* 棰勭紦瀛樻竻鍗曪紙鐩稿璺緞锛屽繀椤讳笌鏈枃浠跺悓鐩綍锛?*/
const CORE = [
  './',
  './login.html',
  './user.html',
  './manifest.json',
  './config.js',
  './logo.jpg',
  './icon-192.png',
  './icon-512.png'
];

/* 瀹夎锛氬啓鍏ユ牳蹇冪紦瀛橈紝骞惰烦杩囩瓑寰呯珛鍗崇敓鏁?*/
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

/* 婵€娲伙細娓呯悊鏃х増鏈紦瀛橈紝骞剁珛鍗虫帴绠℃墍鏈夊鎴风 */
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

/* 璇锋眰鎷︽埅锛氫粎澶勭悊 GET锛涚紦瀛樹紭鍏堬紝鏈懡涓啀璇锋眰缃戠粶骞跺洖濉?*/
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;                      // 鍛戒腑缂撳瓨锛氱洿鎺ヨ繑鍥烇紙绂荤嚎鍙敤锛?      return fetch(req).then(function (res) {
        // 浠呯紦瀛樺悓婧愭垚鍔熷搷搴旓紝閬垮厤姹℃煋缂撳瓨
        if (res && res.ok && req.url.indexOf(self.location.origin) === 0) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });    // 缃戠粶澶辫触涓旀棤缂撳瓨锛氬師鏍峰け璐?    })
  );
});
