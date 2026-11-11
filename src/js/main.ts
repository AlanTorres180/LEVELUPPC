// ============================================================
// IMPORTS
// ============================================================
 
// @ts-ignore  ← evita que TypeScript se queje por el JSON
 
// Respaldo offline: se usa solo si la API/BD no responde.
import rawProductsData from "../data/products_fixed.json";
import "../../style.css";
import "./extras";
 
 
// Ejecuta fn ya mismo si el DOM está listo; si no, espera a DOMContentLoaded.
// Necesario porque este módulo usa top-level await (el DOM puede estar listo antes).
function onReady(fn: () => void): void {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}
 
// ============================================================
// DOM READY
// ============================================================
 
onReady(() => {
  console.log("✅ DOM listo");
});
 
// ============================================================
// TIPOS (Interfaces)
// ============================================================
 
interface Category {
  id: string;
  name: string;
  image: string;
}
 
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  brand: string;
  image: string;
  stock?: number; // viene de MySQL (PRODUCTO.stock_disponible)
}
 
interface ProductsData {
  products: Product[];
  categories?: Category[];
  brands: string[];
}
 
// Catálogo: MySQL vía /api/products. Si el servidor no responde, se usa el JSON local.
async function loadCatalog(): Promise<ProductsData> {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.products) && data.products.length > 0) return data as ProductsData;
    throw new Error("Catálogo vacío");
  } catch (err) {
    console.warn("[Products] API no disponible, usando products_fixed.json:", err);
    return rawProductsData as unknown as ProductsData;
  }
}
const productsData: ProductsData = await loadCatalog();
// Diagnóstico: mostrar distribución de productos por categoría y marca
try {
  const byCat: Record<string, number> = {};
  const byBrand: Record<string, number> = {};
  (productsData.products || []).forEach((p) => {
    const c = (p.category || "").trim();
    const b = (p.brand || "").trim().toLowerCase();
    byCat[c] = (byCat[c] || 0) + 1;
    byBrand[b] = (byBrand[b] || 0) + 1;
  });
  console.log("[Products] Conteo por categoría:", byCat);
  console.log("[Products] Conteo por marca:", byBrand);
} catch {}
 
// ============================================================
// CATEGORÍAS DERIVADAS Y MAPA DE NOMBRES
// ============================================================
 
function deriveCategories(products: Product[]): Category[] {
  const ids = Array.from(new Set((products || []).map((p) => p.category).filter(Boolean)));
  return ids.map((id) => ({
    id,
    // Humanizar: reemplazar guiones por espacios y capitalizar palabras
    name: id
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    image: "",
  }));
}
 
const categories: Category[] = Array.isArray(productsData.categories) && productsData.categories.length > 0
  ? productsData.categories
  : deriveCategories(productsData.products || []);
 
const categoryNameById: Record<string, string> = categories.reduce((acc, c) => {
  acc[c.id] = c.name;
  return acc;
}, {} as Record<string, string>);
 
// ============================================================
// STOCK (fuente de verdad: MySQL; el navegador solo lo muestra)
// ============================================================
 
const DEFAULT_STOCK = 80; // solo aplica al respaldo JSON (sin API)
type StockMap = Record<number, number>;
 
const stockByProduct: StockMap = {};
for (const p of productsData.products || []) {
  stockByProduct[p.id] = typeof p.stock === "number" ? p.stock : DEFAULT_STOCK;
}
 
function getProductStock(productId: number): number {
  const val = stockByProduct[productId];
  return typeof val === "number" && !Number.isNaN(val) ? val : DEFAULT_STOCK;
}
 
// Tras una compra se vuelve a pedir el stock real al servidor
async function syncStockFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) return;
    const data = await res.json();
    for (const p of data.products || []) stockByProduct[p.id] = p.stock;
    refreshStockUI();
  } catch {
    /* sin conexión: se conserva el último valor */
  }
}
 
function refreshStockUI() {
  // Actualiza el texto de stock en todas las tarjetas visibles
  document.querySelectorAll<HTMLElement>(".product-stock[data-product-id]").forEach((el) => {
    const idAttr = el.getAttribute("data-product-id") || "";
    const id = parseInt(idAttr, 10);
    if (!Number.isNaN(id)) {
      el.textContent = `Stock: ${getProductStock(id)}`;
    }
  });
}
 
// ============================================================
// SLIDER
// ============================================================
 
const slides = document.querySelectorAll<HTMLDivElement>(".slide");
const sliderTrack = document.querySelector<HTMLDivElement>(".slider-track");
let currentSlide = 0;
 
function showSlide(index: number): void {
  if (slides.length === 0 || !sliderTrack) return;
  const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
  sliderTrack.style.transform = `translateX(-${safeIndex * 100}%)`;
}
 
// Solo inicializar el auto-rotado si existen slides en la página
if (slides.length > 0) {
  // Mostrar inicialmente la primera slide
  showSlide(0);
  setInterval(() => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }, 3000);
 
  // Navegación con flechas
  const prevBtn = document.querySelector<HTMLButtonElement>(".slider-btn.prev");
  const nextBtn = document.querySelector<HTMLButtonElement>(".slider-btn.next");
  prevBtn?.addEventListener("click", () => {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(currentSlide);
  });
  nextBtn?.addEventListener("click", () => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  });
}
 
// ============================================================
// PRODUCTOS
// ============================================================
 
// Render genérico de tarjetas de producto en cualquier grid
function renderProductCard(product: Product): HTMLDivElement {
  const productCard = document.createElement("div");
  productCard.classList.add("product-card");
  productCard.innerHTML = `
    <div class="product-image">
      <img src="${product.image}" alt="${product.name}" />
    </div>
    <div class="product-info">
      <h3>${product.name}</h3>
      <p style="color: #666; font-size: 14px; margin-bottom: 15px;">${product.brand}</p>
      <div class="product-price">$${product.price.toLocaleString("es-CO")}</div>
      <div class="product-stock" data-product-id="${product.id}" style="color:#4a4a4a;font-size:13px;margin:6px 0 12px;">Stock: ${getProductStock(product.id)}</div>
      <button class="add-to-cart" data-product-id="${product.id}">🛒 Agregar al carrito</button>
    </div>
  `;
  return productCard;
}
 
function renderProductsIntoGrid(grid: HTMLDivElement, filter?: (p: Product) => boolean) {
  grid.innerHTML = "";
  const list = (productsData.products || []).filter((p) => (filter ? filter(p) : true));
  try {
    const debugInfo = {
      category: grid.dataset.category || null,
      brand: grid.dataset.brand || null,
      ids: grid.dataset.ids || null,
      count: list.length,
    };
    console.log("[Products] Rendering grid:", debugInfo);
  } catch {}
  if (list.length === 0) {
    grid.innerHTML = `<div style="text-align:center;color:#666;padding:40px 0;">No hay productos para esta selección.</div>`;
    return;
  }
  list.forEach((product) => grid.appendChild(renderProductCard(product)));
}
 
// Detectar y renderizar en todos los grids disponibles (esperar DOM listo)
function initProductGrids() {
  const allProductGrids = Array.from(document.querySelectorAll<HTMLDivElement>(".products-grid"));
  if (allProductGrids.length === 0) {
    console.warn("[Products] No se encontraron grids en la página");
    return;
  }
  allProductGrids.forEach((grid) => {
    const cat = grid.dataset.category || "";
    const brand = grid.dataset.brand || "";
    const idsAttr = (grid.dataset.ids || "").trim();
    const ids = idsAttr
      ? new Set(
          idsAttr
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n))
        )
      : new Set<number>();
 
    if (ids.size > 0) {
      renderProductsIntoGrid(grid, (p) => ids.has(p.id));
    } else if (cat) {
      renderProductsIntoGrid(grid, (p) => (p.category || "") === cat);
    } else if (brand) {
      renderProductsIntoGrid(grid, (p) => (p.brand || "").toLowerCase() === brand.toLowerCase());
    } else {
      // Sin filtro: el Home usa id="productsGrid"
      renderProductsIntoGrid(grid);
    }
  });
}
 
onReady(initProductGrids);
onReady(refreshStockUI);
 
// ============================================================
// MARCAS (BRANDS)
// ============================================================
 
const brandsList = document.querySelector(".brands-list");
if (brandsList) {
  const brandNames: string[] = Array.isArray(productsData.brands) && productsData.brands.length > 0
    ? productsData.brands
    : Array.from(new Set((productsData.products || []).map((p) => p.brand).filter(Boolean)));
  brandNames.forEach((brand) => {
    const li = document.createElement("li");
    li.textContent = brand;
    brandsList.appendChild(li);
  });
}
 
// ============================================================
// CARRITO
// ============================================================
 
// Recuperar carrito de localStorage o iniciar vacío
let cart: (Product & { quantity: number })[] = JSON.parse(
  localStorage.getItem("cart") || "[]"
);
 
// Elementos del DOM (se consultan dinámicamente para soportar distintas páginas)
function getCartCountEl(): HTMLSpanElement | null {
  return document.querySelector<HTMLSpanElement>(".cart-count");
}
 
function getCartItemsContainer(): HTMLElement | null {
  return document.getElementById("cartSidebarItems") || document.getElementById("cartItems");
}
 
function getCartTotalEl(): HTMLElement | null {
  return document.getElementById("cartSidebarTotal") || document.getElementById("cartTotal");
}
 
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}
 
function updateCartUI() {
  // Actualizar número del carrito
  const cartCountEl = getCartCountEl();
  if (cartCountEl) {
    cartCountEl.textContent = String(cart.reduce((sum, i) => sum + i.quantity, 0));
  }
 
  // Actualizar contenido del sidebar/panel
  const itemsContainer = getCartItemsContainer();
  const totalEl = getCartTotalEl();
  if (!itemsContainer || !totalEl) {
    saveCart();
    return;
  }
 
  itemsContainer.innerHTML = "";
  let total = 0;
 
  cart.forEach((item) => {
    total += item.price * item.quantity;
 
    const itemEl = document.createElement("div");
    itemEl.classList.add("cart-item");
    itemEl.innerHTML = `
      <div class="cart-item-info">
        <img src="${item.image}" alt="${item.name}" width="50" />
        <div>
          <h4>${item.name}</h4>
          <p>$${item.price.toLocaleString("es-CO")} x ${item.quantity}</p>
        </div>
      </div>
      <button class="remove-item" data-id="${item.id}">✕</button>
    `;
    itemsContainer.appendChild(itemEl);
  });
 
  totalEl.textContent = `$${total.toLocaleString("es-CO")}`;
  saveCart();
}
 
// Agregar al carrito
function addToCart(productId: number, silent = false): boolean {
  const product = productsData.products.find((p) => p.id === productId);
  if (!product) return false;
 
  const existing = cart.find((i) => i.id === product.id);
  const enCarrito = existing ? existing.quantity : 0;
  if (enCarrito + 1 > getProductStock(product.id)) {
    if (!silent) alert(`No hay más unidades disponibles de ${product.name}.`);
    return false;
  }
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
 
  updateCartUI();
  if (!silent) alert(`${product.name} agregado al carrito 🛒`);
  return true;
}
 
// Agregar un combo completo (lo dispara el armador por presupuesto)
window.addEventListener("levelup:add-combo", (e) => {
  const items = (e as CustomEvent<{ items: { id: number; cantidad: number }[] }>).detail.items;
  let agregados = 0;
  let omitidos = 0;
  for (const it of items) {
    for (let n = 0; n < it.cantidad; n++) addToCart(it.id, true) ? agregados++ : omitidos++;
  }
  alert(omitidos ? `Se agregaron ${agregados} unidades; ${omitidos} no tenían stock.` : "Combo agregado al carrito 🛒");
});
 
// Delegación global para botones "Agregar al carrito" en cualquier grid
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target && target.classList.contains("add-to-cart")) {
    const idAttr = target.getAttribute("data-product-id") || "";
    const productId = parseInt(idAttr, 10);
    if (!Number.isNaN(productId)) {
      addToCart(productId);
      target.textContent = "✅ Agregado";
      setTimeout(() => (target.textContent = "🛒 Agregar al carrito"), 1200);
    }
  }
});
 
 
// Escuchar clicks para eliminar items del carrito
// Delegación para eliminar items del carrito en cualquier contenedor
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target && target.classList.contains("remove-item")) {
    const id = Number(target.getAttribute("data-id"));
    cart = cart.filter((item) => item.id !== id);
    updateCartUI();
  }
});
 
// ============================================================
// APERTURA/CIERRE DEL CARRITO
// ============================================================
 
function openCart(): void {
  const cartSidebar = document.getElementById("cartSidebar") as HTMLDivElement | null;
  const cartOverlay = document.getElementById("cartOverlay") as HTMLDivElement | null;
  if (cartSidebar) {
    cartSidebar.style.display = "block";
  }
  if (cartOverlay) {
    cartOverlay.style.display = "block";
  }
  document.body.style.overflow = "hidden";
  updateCartUI();
}
 
function closeCart(): void {
  const cartSidebar = document.getElementById("cartSidebar") as HTMLDivElement | null;
  const cartOverlay = document.getElementById("cartOverlay") as HTMLDivElement | null;
  if (cartSidebar) {
    cartSidebar.style.display = "none";
  }
  if (cartOverlay) {
    cartOverlay.style.display = "none";
  }
  document.body.style.overflow = "";
}
 
// Delegación global: abrir/cerrar carrito desde cualquier botón
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const openBtn = target.closest(".cart-btn, #cartBtn, [data-open-cart], .open-cart") as HTMLElement | null;
  const closeBtn = target.closest("#closeCart, #cartClose, .cart-sidebar-close, .cart-close") as HTMLElement | null;
  if (openBtn) {
    e.preventDefault();
    openCart();
  } else if (closeBtn) {
    e.preventDefault();
    closeCart();
  }
});
 
// Cerrar al hacer clic en overlay
document.getElementById("cartOverlay")?.addEventListener("click", () => closeCart());
 
 
// ============================================================
// MODALS (VENTANAS MODALES)
// ============================================================
 
// Función para abrir una ventana modal
function openModal(modalId: string): void {
  const modal = document.getElementById(modalId) as HTMLDivElement;
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevenir scroll del body
  }
}
 
// Función para cerrar una ventana modal
function closeModal(modalId: string): void {
  const modal = document.getElementById(modalId) as HTMLDivElement;
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Restaurar scroll del body
  }
}
 
// Función para cerrar todas las ventanas modales
function closeAllModals(): void {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    (modal as HTMLDivElement).classList.remove('show');
  });
  document.body.style.overflow = '';
}
 
// Event listeners para abrir modales (se agregan a los enlaces del menú)
onReady(() => {
  // Agregar event listeners a los botones de cerrar
  const closeButtons = document.querySelectorAll('.modal-close');
  closeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = button.getAttribute('data-modal');
      if (modalId) {
        closeModal(modalId);
      }
    });
  });
 
  // Cerrar modal al hacer clic fuera del contenido
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        (modal as HTMLDivElement).classList.remove('show');
        document.body.style.overflow = '';
      }
    });
  });
 
  // Cerrar modal con la tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
 
  // Delegación: cerrar cualquier modal al pulsar su botón "×"
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const closeBtn = target.closest('.modal-close') as HTMLElement | null;
    if (closeBtn) {
      e.preventDefault();
      const modalId = closeBtn.getAttribute('data-modal');
      if (modalId) {
        closeModal(modalId);
      }
    }
  });
 
  // Delegación: cerrar modal al hacer clic en el overlay del propio modal
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList && target.classList.contains('modal')) {
      (target as HTMLDivElement).classList.remove('show');
      document.body.style.overflow = '';
    }
  });
 
  console.log("✅ Modals functionality loaded");
});
 
// Hacer las funciones globales para poder usarlas en el HTML
(window as any).openModal = openModal;
(window as any).closeModal = closeModal;
 
// Inicializar interfaz del carrito
updateCartUI();
 
// ============================================================
// CHECKOUT
// ============================================================
 
const checkoutModal = document.getElementById("checkoutModal");
const checkoutItems = document.getElementById("checkoutItems");
const checkoutTotal = document.getElementById("checkoutTotal");
const proceedToCheckoutBtn = document.getElementById("proceedToCheckout");
const closeCheckoutBtn = document.getElementById("closeCheckout");
 
// ============================================================
// PASARELA DE PAGO SIMULADA (sin integraciones externas)
// ============================================================
 
interface CheckoutResult {
  pedido: number;
  factura: string;
  total: number;
}
 
// Envía el pedido a la API: valida stock/precios en MySQL, registra PEDIDO + DETALLE_PEDIDO + FACTURA.
async function submitOrder(cartSnapshot: (Product & { quantity: number })[]): Promise<CheckoutResult> {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() || "";
  const direccion = [val("customerDirection"), val("customerNeighborhood")].filter(Boolean).join(", ");
 
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cliente: {
        nombre: val("customerName"),
        correo: val("customerEmail"),
        telefono: val("customerPhone"),
        documento: val("customerDocument"),
        ciudad: val("customerCity"),
        direccion,
      },
      // Solo ids y cantidades: el servidor calcula precios y total. Los datos de la tarjeta NO se envían.
      items: cartSnapshot.map((i) => ({ id: i.id, cantidad: i.quantity })),
      metodo_pago: "Tarjeta de crédito",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = Array.isArray(data.errores) ? `\n- ${data.errores.join("\n- ")}` : "";
    throw new Error((data.error || `Error ${res.status}`) + detalle);
  }
 
  cart = [];
  saveCart();
  updateCartUI();
  await syncStockFromServer();
  return data as CheckoutResult;
}
 
// ================================
// Modal de Pago con Tarjeta (dinámico)
// ================================
function ensureCardPaymentModal() {
  let modal = document.getElementById("cardPaymentModal") as HTMLDivElement | null;
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "cardPaymentModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h2>Pago con Tarjeta</h2>
          <button class="modal-close" data-modal="cardPaymentModal" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">
          <form id="cardForm">
            <div class="form-group">
              <label for="cardHolder">Nombre Completo *</label>
              <input type="text" id="cardHolder" required />
            </div>
            <div class="form-group">
              <label for="cardNumber">Número de Tarjeta *</label>
              <input type="text" id="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="19" required />
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label for="cardExpiry">Fecha de Expiración (MM/AA) *</label>
                <input type="text" id="cardExpiry" inputmode="numeric" placeholder="MM/AA" maxlength="5" required />
              </div>
              <div class="form-group" style="flex:1;">
                <label for="cardCVV">CVV *</label>
                <input type="text" id="cardCVV" inputmode="numeric" placeholder="123" maxlength="4" required />
              </div>
            </div>
            <div class="checkout-total" style="margin-top: 10px;">
              <span>Total:</span>
              <strong id="cardPaymentTotal">$0</strong>
            </div>
            <div class="form-actions" style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
              <button type="button" class="btn-secondary" id="cancelCardPayment">Cancelar</button>
              <button type="submit" class="btn-primary" id="confirmCardPayment">Pagar Ahora</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
 
  const form = document.getElementById("cardForm") as HTMLFormElement | null;
  const totalEl = document.getElementById("cardPaymentTotal") as HTMLSpanElement | null;
  const cancelBtn = document.getElementById("cancelCardPayment") as HTMLButtonElement | null;
  const confirmBtn = document.getElementById("confirmCardPayment") as HTMLButtonElement | null;
 
  cancelBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal("cardPaymentModal");
  });
 
  return { modal, form, totalEl, cancelBtn, confirmBtn };
}
 
// ================================
// Modal de Éxito de Pago
// ================================
function ensurePaymentSuccessModal() {
  let modal = document.getElementById("paymentSuccessModal") as HTMLDivElement | null;
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "paymentSuccessModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 520px;">
        <div class="modal-header">
          <h2>Gracias por tu compra</h2>
          <button class="modal-close" data-modal="paymentSuccessModal" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body" style="text-align: center;">
          <p>Tu pedido se ha realizado.</p>
          <p>Tu pedido se entregara pronto</p>
          <div style="margin-top: 18px;">
            <button class="btn-primary" id="closeSuccessModal">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
 
  const closeBtn = document.getElementById("closeSuccessModal") as HTMLButtonElement | null;
  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal("paymentSuccessModal");
  });
 
  return { modal };
}
 
function updateCheckoutSummary() {
  if (!checkoutItems || !checkoutTotal) return;
 
  checkoutItems.innerHTML = "";
  let total = 0;
 
  cart.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.classList.add("checkout-item");
    itemEl.innerHTML = `
      <div class="checkout-item-info">
        <img src="${item.image}" alt="${item.name}" width="50" />
        <div>
          <h4>${item.name}</h4>
          <p>$${item.price.toLocaleString("es-CO")} x ${item.quantity}</p>
        </div>
      </div>
    `;
    checkoutItems.appendChild(itemEl);
    total += item.price * item.quantity;
  });
 
  checkoutTotal.textContent = `$${total.toLocaleString("es-CO")}`;
}
 
// Al hacer clic en “Proceder al Pago”, abrir modal de checkout
proceedToCheckoutBtn?.addEventListener("click", () => {
  updateCheckoutSummary();
  openModal("checkoutModal");
});
 
// Cerrar modal de checkout
closeCheckoutBtn?.addEventListener("click", () => {
  closeModal("checkoutModal");
});
 
// Enviar pago → usar pasarela simulada (sin proveedores externos)
onReady(() => {
  const paymentForm = document.getElementById("paymentForm") as HTMLFormElement | null;
  const submitPaymentBtn = document.getElementById("submitPayment") as HTMLButtonElement | null;
  const paymentLoader = document.getElementById("paymentLoader") as HTMLSpanElement | null;
 
  const { modal: cardModal, form: cardForm, totalEl: cardTotalEl, confirmBtn } = ensureCardPaymentModal();
  const { modal: successModal } = ensurePaymentSuccessModal();
 
  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Calcular total del carrito
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (!total || total <= 0) {
        alert("Tu carrito está vacío o el total es inválido.");
        return;
      }
      // Mostrar el modal de tarjeta con el total
      if (cardTotalEl) cardTotalEl.textContent = `$${total.toLocaleString("es-CO")}`;
      openModal("cardPaymentModal");
    });
 
    // Envío del formulario de tarjeta (Pagar Ahora)
    cardForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cartSnapshot = cart.map((i) => ({ ...i }));
      const total = cartSnapshot.reduce((sum, item) => sum + item.price * item.quantity, 0);
      // Se leen los campos DENTRO de este formulario (la página puede tener otros con el mismo id)
      const formEl = e.currentTarget as HTMLFormElement;
      const field = (id: string) => (formEl.querySelector(`#${id}`) as HTMLInputElement | null)?.value.trim() || "";
      const holder = field("cardHolder");
      const number = field("cardNumber").replace(/\s+/g, "");
      const expiry = field("cardExpiry");
      const cvv = field("cardCVV");
 
      // Validaciones mínimas
      const numberValid = /^\d{13,19}$/.test(number);
      const expiryValid = /^(0[1-9]|1[0-2])\/(\d{2})$/.test(expiry);
      const cvvValid = /^\d{3,4}$/.test(cvv);
      const holderValid = holder.length > 3;
 
      if (!holderValid) return alert("Por favor ingresa tu nombre completo.");
      if (!numberValid) return alert("Número de tarjeta inválido.");
      if (!expiryValid) return alert("Fecha de expiración inválida. Usa MM/AA.");
      if (!cvvValid) return alert("CVV inválido.");
 
      // Feedback visual (reutiliza el botón del checkout si existe)
      if (submitPaymentBtn) submitPaymentBtn.disabled = true;
      if (paymentLoader) paymentLoader.style.display = "inline-block";
 
      try {
        const order = await submitOrder(cartSnapshot);
        // Cerrar modales y mostrar mensaje de éxito con el comprobante
        closeModal("cardPaymentModal");
        closeModal("checkoutModal");
        const okText = document.querySelector("#paymentSuccessModal .modal-body p");
        if (okText) okText.textContent = `Pedido #${order.pedido} · Factura ${order.factura} · Total $${order.total.toLocaleString("es-CO")}`;
        openModal("paymentSuccessModal");
      } catch (err) {
        console.error("Error en el checkout:", err);
        alert(`No se pudo completar la compra.\n${String(err)}`);
      } finally {
        if (paymentLoader) paymentLoader.style.display = "none";
        if (submitPaymentBtn) submitPaymentBtn.disabled = false;
      }
    });
    // Cancelar: cerrar modal
    const cancelBtn = document.getElementById("cancelCheckout") as HTMLButtonElement | null;
    cancelBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      closeModal("checkoutModal");
    });
  }
});
 
// ============================================================
// SEARCH MODAL
// ============================================================
 
// Crear el modal de búsqueda si no existe
function ensureSearchModal(): {
  modal: HTMLDivElement | null,
  input: HTMLInputElement | null,
  results: HTMLDivElement | null
} {
  let modal = document.getElementById("searchModal") as HTMLDivElement | null;
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "searchModal";
    modal.className = "modal search-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Buscar Productos</h2>
          <button class="modal-close" data-modal="searchModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <input type="text" id="searchInput" placeholder="Buscar por nombre, marca o categoría" aria-label="Buscar" />
          </div>
          <div id="searchResults" class="search-results"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  const input = document.getElementById("searchInput") as HTMLInputElement | null;
  const results = document.getElementById("searchResults") as HTMLDivElement | null;
  return { modal, input, results };
}
 
function renderSearchResults(results: Product[], resultsContainer: HTMLDivElement | null): void {
  if (!resultsContainer) return;
  resultsContainer.innerHTML = "";
  if (!results || results.length === 0) {
    resultsContainer.innerHTML = '<p class="no-results">Sin resultados. Intenta con otro término.</p>';
    return;
  }
  results.forEach((p) => {
    const el = document.createElement("div");
    el.className = "search-result-item";
    const catName = categoryNameById[p.category] || "—";
    el.innerHTML = `
      <img class="search-result-image" src="${p.image}" alt="${p.name}" />
      <div class="search-result-info">
        <h4 class="search-result-name">${p.name}</h4>
        <p class="search-result-meta">${p.brand} · ${catName}</p>
        <div class="search-result-actions">
          <span class="search-result-price">$${(p.price || 0).toLocaleString('es-CO')}</span>
          <button class="add-to-cart" data-product-id="${p.id}">Agregar al carrito</button>
        </div>
      </div>
    `;
    resultsContainer.appendChild(el);
  });
}
 
function performSearch(query: string, resultsContainer: HTMLDivElement | null): void {
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    if (resultsContainer) {
      resultsContainer.innerHTML = '<p class="hint">Escribe para buscar productos.</p>';
    }
    return;
  }
  const results = (productsData.products || []).filter((p) => {
    const name = (p.name || "").toLowerCase();
    const brand = (p.brand || "").toLowerCase();
    const cat = (categoryNameById[p.category] || "").toLowerCase();
    return name.includes(q) || brand.includes(q) || cat.includes(q);
  }).slice(0, 24);
  renderSearchResults(results, resultsContainer);
}
 
// Inicializar búsqueda cuando el DOM esté listo
onReady(() => {
  const { modal, input, results } = ensureSearchModal();
  const searchBtn = document.querySelector(".search-btn");
 
  // Abrir modal al pulsar el botón de búsqueda
  searchBtn?.addEventListener("click", () => {
    if (modal) {
      openModal("searchModal");
    }
    if (input && results) {
      input.value = "";
      renderSearchResults([], results);
      setTimeout(() => input.focus(), 50);
    }
  });
 
  // Buscar al escribir
  input?.addEventListener("input", (e: Event) => {
    const target = e.target as HTMLInputElement;
    performSearch(target.value, results);
  });
 
  // Enter ejecuta búsqueda
  input?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && input) {
      performSearch(input.value, results);
    }
  });
 
  // Agregar al carrito desde resultados
  results?.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;
    if (target && target.classList.contains("add-to-cart")) {
      const idAttr = target.getAttribute("data-product-id") || "";
      const productId = parseInt(idAttr, 10);
      if (!Number.isNaN(productId)) {
        addToCart(productId);
      }
    }
  });
});
 