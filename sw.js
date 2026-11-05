// Covenantia RM en línea. v7.90: el código de la app vive en su propio archivo (app.<huella>.js) y cada publicación trae
// un service worker distinto (VERSION y APP los pone app/proteger.js --en-linea). Al instalarse, el service worker baja la
// página y el código JUNTOS y los guarda en el equipo; así Chrome deja el código ya preparado (compilado) y la app abre
// casi al instante, también la primera vez tras cada versión nueva.
// Versión nueva: la página pide revisar sola (al abrir, cada 2 minutos y al volver a la ventana) con «?__ver»; eso pide
// al navegador buscar un service worker nuevo. Si lo hay, se instala con la versión nueva completa y, ya lista, se avisa
// a la página → «Hay una versión nueva · Actualizar». Si GitHub todavía entrega la página vieja (sus servidores se ponen
// al día en un par de minutos), la instalación no se completa y se reintenta en la siguiente vuelta: «Actualizar»
// siempre actualiza. La lista de bajas nunca se guarda aquí (la app lleva su propia cuenta del plazo sin conexión), ni el
// regreso del inicio de sesión de OneDrive (lleva un código de un solo uso en la dirección).
const VERSION = "204a841e3c7d";
const APP = "app.204a841e3c7d.js";
const CACHE = "covenantia-rm-" + VERSION;
const PAGINA = new URL("./", location.href).href;
const CODIGO = new URL(APP, location.href).href;
const esPagina = (u) => u.origin === location.origin && (u.href.split(/[?#]/)[0] === PAGINA || u.pathname.endsWith("/index.html"));
const avisar = async () => (await self.clients.matchAll({ type: "window" })).forEach((c) => c.postMessage({ tipo: "covenantia-nueva-version" }));

self.addEventListener("install", (e) => e.waitUntil((async () => {
  const [p, a] = await Promise.all([fetch(PAGINA, { cache: "no-store" }), fetch(CODIGO, { cache: "no-store" })]);
  if (!p.ok || !a.ok) throw new Error("descarga incompleta");
  if (!(await p.clone().text()).includes(APP)) throw new Error("la página todavía es de otra versión");
  const cache = await caches.open(CACHE);
  await cache.put(PAGINA, p);
  await cache.put(CODIGO, a);
  await self.skipWaiting();
})()));

self.addEventListener("activate", (e) => e.waitUntil((async () => {
  const otras = (await caches.keys()).filter((k) => k.startsWith("covenantia-rm") && k !== CACHE);
  await Promise.all(otras.map((k) => caches.delete(k)));
  await self.clients.claim();
  // Solo se avisa si había una versión anterior de este mismo esquema; la de antes de v7.90 ya avisaba por su cuenta.
  if (otras.some((k) => k.startsWith("covenantia-rm-"))) await avisar();
})()));

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || /\/(bajas\.json|onedrive\.html)$/.test(u.pathname)) return;
  if (u.searchParams.has("__ver")) {
    e.respondWith(self.registration.update().catch(() => {}).then(() => new Response("ok")));
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = await cache.match(esPagina(u) ? PAGINA : e.request);
    if (guardada) return guardada;
    try {
      const r = await fetch(e.request);
      if (r.ok && !esPagina(u)) await cache.put(e.request, r.clone());
      return r;
    } catch (err) { return Response.error(); }
  })());
});
