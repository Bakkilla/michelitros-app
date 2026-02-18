const PHONE = '56984643355';

/**
 * URL del Web App (Apps Script) que expone productos y recibe órdenes.
 * Debe terminar en /exec
 */
const BRIDGE_URL = 'https://script.google.com/macros/s/AKfycby2N4OTQd3cp2Z9TOJsSEUPzR90It6izDVPwo-v9QbJuQ7LIytMpiddrMh46R9nFXqF/exec';

const FALLBACK_PRODUCTS = [
  { id: '1', cat: 'Alcohol', name: 'Whisky Jack Daniels', price: 23500, active: true, sort: 10 },
  { id: '2', cat: 'Alcohol', name: 'Ron Havana', price: 20500, active: true, sort: 20 },
  { id: '3', cat: 'Alcohol', name: 'Vodka Absolut', price: 22500, active: true, sort: 30 },
  { id: '4', cat: 'Cerveza', name: 'Cerveza 1L', price: 2600, active: true, sort: 40 },
  { id: '5', cat: 'Bebidas', name: 'Bebida 1.5L', price: 3000, active: true, sort: 50 },
  { id: '6', cat: 'Hielo', name: 'Bolsa de hielo', price: 1800, active: true, sort: 60 },
  { id: '7', cat: 'Snacks', name: 'Papas fritas', price: 1500, active: true, sort: 70 }
];

const LS_CART_KEY = 'marcelo_cart';
const LS_PRODUCTS_KEY = 'michelitros_products_cache';
const LS_PRODUCTS_TS_KEY = 'michelitros_products_cache_ts';

const $ = (id) => document.getElementById(id);

const state = {
  q: '',
  cat: 'Todos',
  cart: JSON.parse(localStorage.getItem(LS_CART_KEY) || '{}'),
  products: loadCachedProducts_() || [...FALLBACK_PRODUCTS]
};

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').hidden = false;
});

$('installBtn').onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBtn').hidden = true;
};

const money = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;
const saveCart = () => localStorage.setItem(LS_CART_KEY, JSON.stringify(state.cart));

function loadCachedProducts_() {
  try {
    const raw = localStorage.getItem(LS_PRODUCTS_KEY);
    const arr = JSON.parse(raw || 'null');
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr;
  } catch {
    return null;
  }
}

function saveProductsCache_(products) {
  localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify(products));
  localStorage.setItem(LS_PRODUCTS_TS_KEY, String(Date.now()));
}

function getCacheDateLabel_() {
  const ts = Number(localStorage.getItem(LS_PRODUCTS_TS_KEY) || 0);
  if (!ts) return '';
  return new Date(ts).toLocaleString('es-CL', { hour12: false });
}

function normalizeProduct_(p, i) {
  const id = String(p.id ?? p.ProductoID ?? i + 1);
  const name = String(p.name ?? p.Nombre ?? '').trim();
  const cat = String(p.cat ?? p.Categoria ?? 'General').trim() || 'General';
  const price = Number(p.price ?? p.Precio ?? 0);
  const activeRaw = p.active ?? p.Activo ?? 'Sí';
  const sort = Number(p.sort ?? p.Orden ?? i + 1);

  const active = !['no', 'false', '0', 'inactivo'].includes(String(activeRaw).toLowerCase().trim());

  return { id, name, cat, price, active, sort };
}

function categories() {
  const set = new Set(state.products.map((p) => p.cat));
  return ['Todos', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
}

function renderChips() {
  const cats = categories();
  if (!cats.includes(state.cat)) state.cat = 'Todos';

  $('chips').innerHTML = cats
    .map((c) => `<button class='${state.cat === c ? 'active' : ''}' data-c='${c}'>${c}</button>`)
    .join('');

  [...$('chips').querySelectorAll('button')].forEach((b) => {
    b.onclick = () => {
      state.cat = b.dataset.c;
      renderGrid();
      renderChips();
    };
  });
}

function add(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  renderCart();
}

function sub(id) {
  state.cart[id] = Math.max(0, (state.cart[id] || 0) - 1);
  if (!state.cart[id]) delete state.cart[id];
  saveCart();
  renderCart();
}

function filtered() {
  const q = state.q.toLowerCase().trim();
  return state.products
    .filter((p) => (state.cat === 'Todos' || p.cat === state.cat) && p.name.toLowerCase().includes(q))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es'));
}

function renderGrid() {
  const data = filtered();

  if (!data.length) {
    $('grid').innerHTML = `<article class='item'><div class='name'>No hay productos para esta búsqueda.</div></article>`;
    return;
  }

  $('grid').innerHTML = data
    .map(
      (p) => `<article class='item'>
      <div class='cat'>${p.cat}</div>
      <div class='name'>${p.name}</div>
      <div class='price'>${money(p.price)}</div>
      <button data-id='${p.id}'>Agregar</button>
    </article>`
    )
    .join('');

  [...$('grid').querySelectorAll('button')].forEach((b) => {
    b.onclick = () => add(b.dataset.id);
  });
}

function renderCart() {
  const ids = Object.keys(state.cart);

  if (!ids.length) {
    $('cartItems').innerHTML = '<small>Tu carro está vacío.</small>';
    $('subtotal').textContent = '$0';
    return;
  }

  let total = 0;
  $('cartItems').innerHTML = ids
    .map((id) => {
      const p = state.products.find((x) => x.id === id);
      if (!p) return '';
      const q = state.cart[id];
      const st = p.price * q;
      total += st;

      return `<div class='row'>
      <div>${p.name}<br><small>${money(p.price)}</small></div>
      <div class='qty'><button data-s='${id}'>-</button><b>${q}</b><button data-a='${id}'>+</button></div>
      <strong>${money(st)}</strong>
    </div>`;
    })
    .join('');

  $('subtotal').textContent = money(total);

  [...$('cartItems').querySelectorAll('[data-a]')].forEach((b) => (b.onclick = () => add(b.dataset.a)));
  [...$('cartItems').querySelectorAll('[data-s]')].forEach((b) => (b.onclick = () => sub(b.dataset.s)));
}

function setSyncStatus(ok, text) {
  const el = $('syncStatus');
  if (!el) return;
  el.className = `sync ${ok ? 'ok' : 'warn'}`;
  el.textContent = text;
}

function applyProducts(products, sourceLabel = '') {
  const cleaned = products
    .map(normalizeProduct_)
    .filter((p) => p.active && p.name && Number.isFinite(p.price) && p.price > 0);

  if (!cleaned.length) return false;

  state.products = cleaned;
  renderChips();
  renderGrid();
  renderCart();

  if (sourceLabel) setSyncStatus(true, sourceLabel);
  return true;
}

async function loadProductsFromBridge() {
  if (!BRIDGE_URL) {
    const label = getCacheDateLabel_();
    setSyncStatus(false, label ? `Sin bridge • cache ${label}` : 'Sin bridge configurado');
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${BRIDGE_URL}?action=products&t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!Array.isArray(json.products) || !json.products.length) throw new Error('empty products');

    const ok = applyProducts(json.products, 'Catálogo en línea');
    if (!ok) throw new Error('invalid products after normalize');

    saveProductsCache_(state.products);
  } catch (e) {
    console.warn('Bridge products error', e);
    const cached = loadCachedProducts_();
    if (cached?.length) {
      applyProducts(cached);
      const label = getCacheDateLabel_();
      setSyncStatus(false, label ? `Sin conexión • cache ${label}` : 'Sin conexión • cache local');
    } else {
      applyProducts(FALLBACK_PRODUCTS);
      setSyncStatus(false, 'Sin conexión • catálogo básico');
    }
  } finally {
    clearTimeout(timer);
  }
}

async function logOrder(orderPayload) {
  if (!BRIDGE_URL) return { ok: false };

  try {
    const res = await fetch(`${BRIDGE_URL}?action=order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const out = await res.json().catch(() => ({}));
    return { ok: res.ok, ...out };
  } catch {
    return { ok: false };
  }
}

$('search').oninput = (e) => {
  state.q = e.target.value;
  renderGrid();
};

$('checkoutBtn').onclick = async () => {
  const ids = Object.keys(state.cart);
  if (!ids.length) return alert('Agrega productos al carro');

  const cliente = $('cliente').value.trim() || 'Cliente';
  const nota = $('nota').value.trim();
  let total = 0;

  const lines = ids
    .map((id) => {
      const p = state.products.find((x) => x.id === id);
      if (!p) return null;
      const q = state.cart[id];
      const st = p.price * q;
      total += st;
      return { id, name: p.name, qty: q, unit: p.price, subtotal: st };
    })
    .filter(Boolean);

  const textLines = lines.map((l) => `• ${l.name} x${l.qty} = ${money(l.subtotal)}`);
  const msg = [
    `Hola Marcelo, soy ${cliente}. Quiero pedir:`,
    '',
    ...textLines,
    '',
    `Total: ${money(total)}`,
    nota ? `Nota: ${nota}` : '',
    'Retiro en tienda.'
  ]
    .filter(Boolean)
    .join('\n');

  const payload = {
    customer: cliente,
    note: nota,
    total,
    items: lines,
    createdAt: new Date().toISOString(),
    channel: 'pwa'
  };

  const saved = await logOrder(payload);
  if (!saved.ok) {
    alert('Pedido enviado por WhatsApp. No se pudo guardar en panel ahora.');
  }

  window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`, '_blank');
};

(async function init() {
  // Render inmediato con cache/fallback, luego sincroniza en línea
  applyProducts(state.products, 'Cargando catálogo...');

  await loadProductsFromBridge();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW register error', e));
  }
})();
