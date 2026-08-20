/* ============================================================
   MapeiaAgro Campo — service worker.

   Existe por um motivo só: fazenda fica sem sinal. Sem isto o app precisa da
   rede para abrir — o Leaflet vem de CDN — e ficar sem internet no meio do
   talhão significa não abrir o aplicativo.

   Três caches, com políticas diferentes de propósito:

     casca    a página e o Leaflet. REDE PRIMEIRO com prazo curto, caindo no
              cache. Assim a versão nova chega sozinha quando há sinal, e a
              antiga abre quando não há. O contrário (cache primeiro) deixaria
              o operador rodando semanas com uma versão velha sem saber.

     ladrilho a imagem de satélite. CACHE PRIMEIRO — ladrilho não muda, e no
              campo cada byte é caro. É este cache que a tela "guardar o mapa"
              enche de propósito antes de sair.

     resto    nada. A previsão do tempo o app já guarda sozinho no aparelho,
              e cachear resposta de API aqui seria mostrar tempo de ontem
              achando que é de hoje.
   ============================================================ */
const VERSAO   = 'v1';
const CASCA    = 'mapeia-campo-casca-' + VERSAO;
const LADRILHO = 'mapeia-campo-ladrilho-' + VERSAO;

/* Teto do cache de ladrilho. A 256 px, cada um pesa 15 a 40 KB: 1.500 dão
   ~35 MB. Sem teto, quem abre o app em muitos talhões enche o aparelho e o
   próprio navegador começa a despejar o cache inteiro — inclusive a casca,
   que é o que faz o app abrir. Melhor derrubar ladrilho velho por conta. */
const TETO_LADRILHOS = 1500;

const CASCA_ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './icone-192.png',
  './icone-512.png',
  './icone-512m.png',
  './icone-180.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

const ehLadrilho = u => u.hostname === 'server.arcgisonline.com';
const ehTempo    = u => u.hostname.endsWith('open-meteo.com');

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CASCA);
    /* Um por um, e não addAll: com addAll, uma única falha (CDN fora do ar,
       sinal caindo) descarta TUDO e o app fica sem casca nenhuma. */
    await Promise.all(CASCA_ARQUIVOS.map(async u => {
      try { await c.add(new Request(u, { cache: 'reload' })); } catch (e) {}
    }));
  })());
  /* Sem skipWaiting: a versão nova espera o app ser fechado. Trocar o código
     debaixo de quem está no meio de uma medição é pior que esperar. A página
     avisa que há atualização e oferece o botão. */
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes
      .filter(n => n.startsWith('mapeia-campo-') && n !== CASCA && n !== LADRILHO)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', ev => {
  if (ev.data === 'ASSUMIR') self.skipWaiting();
  if (ev.data === 'CONTAR') contarLadrilhos(ev.source);
  if (ev.data === 'LIMPAR') limparLadrilhos(ev.source);
});

async function contarLadrilhos(cliente) {
  const c = await caches.open(LADRILHO);
  const ks = await c.keys();
  let bytes = 0;
  /* amostra, não soma tudo: ler 1.500 respostas para dar um número na tela
     custa mais que o número vale */
  const amostra = ks.slice(0, 25);
  for (const k of amostra) {
    const r = await c.match(k);
    if (r) { try { bytes += (await r.clone().blob()).size; } catch (e) {} }
  }
  const medio = amostra.length ? bytes / amostra.length : 0;
  if (cliente) cliente.postMessage({ tipo: 'LADRILHOS', n: ks.length, bytes: Math.round(medio * ks.length) });
}

async function limparLadrilhos(cliente) {
  await caches.delete(LADRILHO);
  if (cliente) cliente.postMessage({ tipo: 'LADRILHOS', n: 0, bytes: 0 });
}

async function podarLadrilhos() {
  const c = await caches.open(LADRILHO);
  const ks = await c.keys();
  if (ks.length <= TETO_LADRILHOS) return;
  /* keys() devolve na ordem em que entraram, então os primeiros são os mais
     antigos. Corta 20% de uma vez para não podar a cada requisição. */
  const cortar = ks.slice(0, ks.length - Math.floor(TETO_LADRILHOS * 0.8));
  await Promise.all(cortar.map(k => c.delete(k)));
}

/* rede primeiro, com prazo: sem o prazo, sinal ruim (que responde em 40 s)
   é pior que sinal nenhum — o app fica em branco esperando */
async function redePrimeiro(req, prazoMs) {
  const cache = await caches.open(CASCA);
  try {
    const resposta = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('prazo')), prazoMs))
    ]);
    if (resposta && resposta.ok) cache.put(req, resposta.clone());
    return resposta;
  } catch (e) {
    const guardada = await cache.match(req, { ignoreSearch: true });
    if (guardada) return guardada;
    if (req.mode === 'navigate') {
      const raiz = await cache.match('./index.html') || await cache.match('./');
      if (raiz) return raiz;
    }
    throw e;
  }
}

async function cachePrimeiro(req, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const resposta = await fetch(req);
  if (resposta && (resposta.ok || resposta.type === 'opaque')) {
    cache.put(req, resposta.clone());
    if (nomeCache === LADRILHO) podarLadrilhos();
  }
  return resposta;
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  if (ehTempo(u)) return;                       /* rede pura — ver o cabeçalho */
  if (ehLadrilho(u)) { ev.respondWith(cachePrimeiro(req, LADRILHO)); return; }

  const daCasca = CASCA_ARQUIVOS.some(a => req.url === new URL(a, self.registration.scope).href);
  if (req.mode === 'navigate' || daCasca) {
    ev.respondWith(redePrimeiro(req, req.mode === 'navigate' ? 3500 : 6000));
  }
});
