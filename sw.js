// Covenantia RM en línea. v7.84j: abre AL INSTANTE con la copia guardada en el equipo y revisa la red por detrás.
// v7.84m: la página pide revisar sola (al abrir, cada 2 minutos y al volver a la ventana) con «?__ver»: si la red trae una
// versión distinta, se guarda en el equipo y se avisa a la página → «Hay una versión nueva · Actualizar»; con un clic se
// carga ya la nueva (sin F5 dobles). Sin copia guardada (primera vez) o sin red, como siempre.
// La lista de bajas nunca se guarda aquí (la app lleva su propia cuenta del plazo sin conexión), ni el regreso del
// inicio de sesión de OneDrive (lleva un código de un solo uso en la dirección).
const CACHE = "covenantia-rm";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
const huella = (r) => r ? (r.headers.get("etag") || r.headers.get("last-modified") || r.headers.get("content-length") || "") : "";
const avisar = async () => (await self.clients.matchAll({ type: "window" })).forEach((c) => c.postMessage({ tipo: "covenantia-nueva-version" }));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || /\/(bajas\.json|onedrive\.html)$/.test(u.pathname)) return;
  if (u.searchParams.has("__ver")) {   // revisión pedida por la página: compara la app de la red con la guardada
    e.respondWith((async () => {
      const cache = await caches.open(CACHE), pagina = new Request(new URL("./", location.href).href);
      const guardada = await cache.match(pagina, { ignoreSearch: true });
      try {
        // v7.84n: primero solo pregunta si cambió (HEAD, unos bytes); baja la app completa únicamente si hay versión nueva.
        const h = await fetch(pagina, { method: "HEAD", cache: "no-store" });
        if (h.ok && huella(h) && huella(h) !== huella(guardada)) {
          const r = await fetch(pagina, { cache: "no-store" });
          if (r.ok) { await cache.put(pagina, r.clone()); if (guardada) await avisar(); }
        }
      } catch (err) { /* sin red: se revisa después */ }
      return new Response("ok");
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then(async (r) => {
      if (r.ok) {
        await cache.put(e.request, r.clone());
        if (guardada && e.request.mode === "navigate" && huella(r) && huella(r) !== huella(guardada)) await avisar();
      }
      return r;
    }).catch(() => guardada);
    if (guardada) { e.waitUntil(red); return guardada; }
    return red;
  })());
});
