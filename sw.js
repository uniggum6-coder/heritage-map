// 국가유산지도 서비스 워커
//
// v3에서 바뀐 것 — 저장 범위를 우리 파일로 좁혔다.
//   예전(v2)에는 GET 요청이면 뭐든 다 저장했다. 지도 그림(타일)은 조금만 움직여도
//   수천 장이 쌓이고, 국가유산청 사진까지 전부 들어왔다. 저장공간이 넉넉한 폰은
//   버텼지만, 빠듯한 폰에서는 저장이 실패하면서 지도 그림이 통째로 안 뜨는 일이
//   생겼다(점은 코드로 그리는 원이라 그대로 보이고 지도만 사라짐).
//   이제는 우리 사이트 주소의 파일만 저장하고, 타일·사진·로그인은 손대지 않는다.
const CACHE_NAME = 'heritage-map-v3';

// 설치할 때 미리 받아두는 것은 껍데기만. 가볍게 둬야 설치가 실패하지 않는다.
// (예전에는 23MB짜리 data_map.js 를 여기서 받았는데, 저장공간이 모자라면
//  설치 자체가 통째로 실패해서 서비스 워커가 아예 안 올라왔다)
const CORE_ASSETS = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})       // 하나라도 못 받으면 그냥 넘어간다. 설치는 막지 않는다.
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // 이름이 다른 옛 캐시(heritage-map-v2)는 여기서 통째로 지워진다.
    // 타일이 가득 들어찬 옛 캐시가 이때 비워지므로, 새 버전을 한 번 열기만 하면
    // 저장공간이 저절로 정리된다.
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).catch(() => {})
  );
  self.clients.claim();
});

// 저장해도 되는 요청인지 — 우리 사이트의 GET 요청만.
function hmCacheable(request) {
  if (request.method !== 'GET') return false;
  let url;
  try { url = new URL(request.url); } catch (e) { return false; }
  // 다른 사이트 것은 건드리지 않는다:
  //   지도 타일(tile.openstreetmap.org), 국가유산청 사진(khs.go.kr),
  //   구글 로그인·Firebase(gstatic.com, googleapis.com), 라이브러리(cdnjs) 등
  if (url.origin !== self.location.origin) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return true;
}

// 네트워크를 먼저 쓴다. 연결이 안 될 때만 저장해둔 것을 꺼낸다.
self.addEventListener('fetch', (event) => {
  // 우리 파일이 아니면 아무것도 하지 않는다 — 브라우저가 알아서 하게 둔다.
  // respondWith 를 부르지 않는 것이 핵심이다. 서비스 워커를 거치지 않으므로
  // 타일이 서비스 워커 문제로 실패하는 일이 사라진다.
  if (!hmCacheable(event.request)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 정상으로 받은 것만 저장한다. 404나 불투명 응답은 저장하지 않는다.
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy))
            // 저장공간이 모자라면 조용히 넘어간다.
            // 예전에는 여기서 실패해도 잡지 않아 오류가 그대로 떠다녔다.
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
