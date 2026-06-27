self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open("pos-cache").then(cache=>{
      return cache.addAll([
        "app.html",
        "css/style.css",
        "js/app.js"
      ]);
    })
  );
});

self.addEventListener("fetch", e=>{
  e.respondWith(
    caches.match(e.request).then(r=>{
      return r || fetch(e.request);
    })
  );
});