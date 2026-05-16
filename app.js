const TAX_RATE = 0.11;

const IMAGE_BANK = [
  "https://images.pexels.com/photos/25409636/pexels-photo-25409636.jpeg?auto=compress&cs=tinysrgb&w=500",
  "https://images.pexels.com/photos/14537194/pexels-photo-14537194.jpeg?auto=compress&cs=tinysrgb&w=500",
  "https://images.pexels.com/photos/40594/lemon-tea-cold-beverages-summer-offerings-40594.jpeg?auto=compress&cs=tinysrgb&w=500",
  "https://images.pexels.com/photos/33496466/pexels-photo-33496466.jpeg?auto=compress&cs=tinysrgb&w=500",
  "https://images.pexels.com/photos/8742029/pexels-photo-8742029.jpeg?auto=compress&cs=tinysrgb&w=500",
  "https://images.pexels.com/photos/7656391/pexels-photo-7656391.jpeg?auto=compress&cs=tinysrgb&w=500",
  "https://images.pexels.com/photos/4438014/pexels-photo-4438014.jpeg?auto=compress&cs=tinysrgb&w=500",
  "https://images.pexels.com/photos/19165615/pexels-photo-19165615.jpeg?auto=compress&cs=tinysrgb&w=500"
];

const FALLBACK_MENU = [
  { id: 1, name: "Kopi Susu", category: "SIGNATURE COFFEE", price: 12000, best: true, stock: true },
  { id: 2, name: "Tiramisu", category: "SIGNATURE COFFEE", price: 15000, best: true, stock: true },
  { id: 3, name: "Americano", category: "CLASIC COFEE", price: 10000, best: false, stock: true },
  { id: 4, name: "Latte", category: "SPECIAL MENU", price: 10000, best: false, stock: true },
  { id: 5, name: "Regal", category: "FRAPE & BLEND", price: 20000, best: true, stock: true },
  { id: 6, name: "Lychee Tea", category: "TEA & MATCHA", price: 15000, best: false, stock: true },
  { id: 7, name: "Strawberry Yakult", category: "NON COFEE", price: 10000, best: true, stock: true }
];

const rawMenu = typeof menuItems !== "undefined" ? menuItems : FALLBACK_MENU;

const MENU = rawMenu.map((item, index) => ({
  id: item.id ?? index + 1,
  name: titleCase(item.name),
  cat: normalizeCategory(item.category || item.cat || "Menu"),
  price: Number(item.price || 0),
  best: Boolean(item.best),
  stock: item.stock !== false,
  color: item.color || "linear-gradient(135deg, #062f24, #d9b24c)",
  img: item.img || IMAGE_BANK[index % IMAGE_BANK.length]
}));

const USER_ROLES = { Admin: "Admin", Kasir: "Kasir", Kitchen: "Kitchen" };
let authToken = null;
let loginInProgress = false;
let appEventsBound = false;

function lockApp() {
  $("#appShell").style.display = "none";
  $("#loginShell").style.display = "grid";
}

function unlockApp() {
  $("#loginShell").style.display = "none";
  $("#appShell").style.display = "block";
}

function showLoginError(message) {
  $("#loginError").textContent = message;
}

function showActionError(selector, message) {
  const el = $(selector);
  if (el) el.textContent = message;
}

function showLoader(message = "Memuat...") {
  const overlay = $("#loaderOverlay");
  if (!overlay) return;
  overlay.querySelector(".loader-box").textContent = message;
  overlay.classList.add("show");
}

function hideLoader() {
  const overlay = $("#loaderOverlay");
  if (!overlay) return;
  overlay.classList.remove("show");
}

async function apiFetch(url, options = {}) {
  showLoader("Memproses...");
  try {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      console.error("[API] JSON parse error:", e, "text:", text.slice(0, 100));
    }
    if (!response.ok) {
      let errorMsg = body?.error || body?.message || `Request gagal: ${response.status}`;
      const details = body?.details ? ` (${body.details})` : "";
      if (!body && text) {
        errorMsg = text.trim() || errorMsg;
      }
      throw new Error(`${errorMsg}${details}`);
    }
    return body;
  } catch (error) {
    console.error("[API] Fetch error:", error);
    throw new Error(error.message || "Request gagal. Cek koneksi atau server.");
  } finally {
    hideLoader();
  }
}

function setUserSession(user, token) {
  state.user = user;
  authToken = token;
  const userChip = $("#userChip");
  if (userChip) userChip.textContent = user.username.charAt(0).toUpperCase();
}

async function handleLogin(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (loginInProgress) return;
  const username = $("#loginUsername").value.trim();
  const password = $("#loginPassword").value;
  if (!username || !password) {
    return showLoginError("Isi username dan password terlebih dahulu.");
  }
  loginInProgress = true;
  const loginButton = $("#loginBtn");
  if (loginButton) loginButton.disabled = true;
  try {
    const data = await apiFetch("/api/auth", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setUserSession(data.user, data.token);
    showLoginError("");
    unlockApp();
    await initApp();
  } catch (error) {
    console.error("Login error", error);
    hideLoader();
    showLoginError(error.message || "Gagal login. Cek koneksi atau environment.");
  } finally {
    loginInProgress = false;
    if (loginButton) loginButton.disabled = false;
  }
}

async function initApp() {
  await loadRemoteOrders();
  bindEvents();
  renderAll();
  await switchPage("pos");
}

function supportsHotCool(item) {
  if (!item) return false;
  const name = String(item.name || "").trim().toLowerCase();
  return item.cat === "Clasic Cofee" || name === "thai tea" || name === "matcha";
}

function getIceOptionConfig(item) {
  if (supportsHotCool(item)) {
    return { label: "Suhu", options: ["Hot", "Cool"], defaultValue: "Cool" };
  }
  return { label: "Level Es", options: ["Less", "Normal", "Extra"], defaultValue: "Normal" };
}

function renderIceOptionGroup(item) {
  const group = document.querySelector('.option-group[data-option="ice"]');
  if (!group) return;
  const config = getIceOptionConfig(item);
  group.querySelector('span').textContent = config.label;
  const buttons = group.querySelector('div');
  buttons.innerHTML = config.options
    .map((value) => `<button class="opt-btn${value === config.defaultValue ? " active" : ""}" data-value="${value}" type="button">${value}</button>`)
    .join("");
}

async function loadRemoteOrders() {
  try {
    const data = await apiFetch("/api/orders");
    state.orders = Array.isArray(data.orders) ? data.orders.map((order) => ({ ...order, started: Number(order.started) })) : [];
    state.orderNum = Number.isFinite(data.nextOrderNum) ? data.nextOrderNum : 1;
  } catch (error) {
    console.warn("Gagal memuat order", error);
    state.orders = [];
    state.orderNum = 1;
  }
}

const PROMOS = [
  { tag: "Bundle", title: "Signature Pair", desc: "Es Kopi Susu + Tea Series hemat Rp 5.000" },
  { tag: "Time", title: "Happy Hour", desc: "Diskon 15% jam 15.00 - 17.00" },
  { tag: "Member", title: "Stamp Reward", desc: "Beli 10 minuman gratis 1 Signature Coffee" },
  { tag: "Vintage", title: "Minang Classic", desc: "Teh Talua + Kopi Hitam paket hemat pagi" }
];

const pageTitles = {
  dashboard: "Dashboard",
  pos: "POS Kasir",
  kitchen: "Kitchen Display",
  orders: "Riwayat Orders",
  menu: "Manajemen Menu",
  users: "Pengguna",
  promo: "Promo & Loyalty",
  customers: "Customer Display",
  reports: "Laporan Penjualan",
  settings: "Settings"
};

const state = {
  page: "dashboard",
  currentCat: "Semua",
  query: "",
  cart: [],
  orders: [],
  orderNum: 1,
  orderType: "Dine In",
  currentItem: null,
  custom: { sugar: "100%", ice: "Normal", size: "Regular", extra: false, notes: "" },
  payMethod: "Cash",
  reportRange: "weekly",
  user: null,
  users: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmt = (value) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
const nextQueue = () => `SD${String(state.orderNum).padStart(3, "0")}`;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function titleCase(value) {
  return String(value || "").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategory(value) {
  const cat = String(value || "").trim().toUpperCase();
  const map = {
    "SIGNATURE COFFEE": "Signature Coffee",
    "CLASIC COFEE": "Clasic Cofee",
    "CLASSIC COFFEE": "Clasic Cofee",
    "SPECIAL MENU": "Clasic Cofee",
    "FRAPE & BLEND": "Frape & Blend",
    "FRAPPE & BLEND": "Frape & Blend",
    "TEA & MATCHA": "Tea & Matcha",
    "TEA SERIES": "Tea Series",
    COFEE: "Coffee",
    COFFEE: "Coffee",
    "NON COFEE": "Non Coffee",
    "NON COFFEE": "Non Coffee",
    BLEND: "Blend",
    "VINTAGE MENU": "Vintage Menu"
  };
  return map[cat] || titleCase(value);
}

function supportsHotCool(item) {
  if (!item) return false;
  const name = String(item.name || "").trim().toLowerCase();
  return item.cat === "Clasic Cofee" || name === "thai tea" || name === "matcha";
}

function getIceOptionConfig(item) {
  if (supportsHotCool(item)) {
    return { label: "Suhu", options: ["Hot", "Cool"], defaultValue: "Cool" };
  }
  return { label: "Level Es", options: ["Less", "Normal", "Extra"], defaultValue: "Normal" };
}

function renderIceOptionGroup(item) {
  const group = document.querySelector('.option-group[data-option="ice"]');
  if (!group) return;
  const config = getIceOptionConfig(item);
  group.querySelector('span').textContent = config.label;
  const buttons = group.querySelector('div');
  buttons.innerHTML = config.options
    .map((value) => `<button class="opt-btn${value === config.defaultValue ? " active" : ""}" data-value="${value}" type="button">${value}</button>`)
    .join("");
}

function iconRefresh() {
  if (window.lucide) lucide.createIcons();
}

function cartTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.finalPrice * item.qty, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  return { subtotal, tax, total: subtotal + tax };
}

function showToast(message, type = "info") {
  const container = $("#toast-container");
  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

async function switchPage(page) {
  if (!state.user) {
    return lockApp();
  }

  state.page = page;
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${page}Page`));
  $$(".sidebar-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
  $("#pageTitle").textContent = pageTitles[page] || page;

  if (page === "users") {
    await loadUsers();
  }
  if (page === "reports") renderReports();
  if (page === "customers") renderCustomerDisplay();
  if (page === "users") renderUsersPage();
  iconRefresh();
}

function categories() {
  return ["Semua", ...new Set(MENU.map((item) => item.cat))];
}

function filteredMenu() {
  const query = state.query.trim().toLowerCase();
  return MENU.filter((item) => {
    const catMatch = state.currentCat === "Semua" || item.cat === state.currentCat;
    const queryMatch = !query || `${item.name} ${item.cat}`.toLowerCase().includes(query);
    return catMatch && queryMatch;
  });
}

function renderCategories() {
  $("#categoryBar").innerHTML = categories().map((cat) => `
    <button class="cat-btn ${cat === state.currentCat ? "active" : ""}" data-cat="${cat}" type="button">${cat}</button>
  `).join("");
}

function renderMenuGrid() {
  const items = filteredMenu();
  $("#menuGrid").innerHTML = items.map((item) => `
    <button class="menu-card" data-item="${item.id}" type="button" ${item.stock ? "" : "disabled"}>
      <div class="menu-media">
        ${item.img ? `<img src="${esc(item.img)}" alt="${esc(item.name)}" loading="lazy" onerror="this.parentElement.style.background='${item.color}'; this.remove()" />` : `<div class="menu-fallback" style="background:${item.color}">STARDUCKS</div>`}
        ${item.best ? '<span class="best-badge">Best Seller</span>' : ""}
        ${item.stock ? "" : '<span class="stock-badge">Habis</span>'}
      </div>
      <div class="menu-copy">
        <h4>${esc(item.name)}</h4>
        <p>${esc(item.cat)}</p>
        <strong>${fmt(item.price)}</strong>
      </div>
    </button>
  `).join("") || emptyState("Menu tidak ditemukan.");
}

function renderCart() {
  const totals = cartTotals();
  $("#queueDisplay").textContent = `Antrean: ${nextQueue()}`;
  $("#cartMeta").textContent = `${state.orderType} · ${nextQueue()}`;
  $("#subtotalValue").textContent = fmt(totals.subtotal);
  $("#taxValue").textContent = fmt(totals.tax);
  $("#totalValue").textContent = fmt(totals.total);
  $("#payBtn").disabled = state.cart.length === 0;

  $("#cartItems").innerHTML = state.cart.length ? state.cart.map((item) => `
    <article class="cart-row" data-uid="${item.uid}">
      <div class="cart-copy">
        <strong>${item.name}</strong>
        <span>${cartDetails(item)}</span>
        <b>${fmt(item.finalPrice * item.qty)}</b>
      </div>
      <div class="qty-actions">
        <button data-cart-action="dec" data-uid="${item.uid}" type="button">-</button>
        <span>${item.qty}</span>
        <button data-cart-action="inc" data-uid="${item.uid}" type="button">+</button>
        <button class="trash" data-cart-action="del" data-uid="${item.uid}" type="button"><i data-lucide="trash-2"></i></button>
      </div>
    </article>
  `).join("") : emptyState("Belum ada pesanan masuk.");
}

function cartDetails(item) {
  const iceLabel = supportsHotCool(item) ? `Suhu ${item.ice}` : `Es ${item.ice}`;
  return [`Gula ${item.sugar}`, iceLabel, item.size, item.extra ? "+Extra" : null, item.notes].filter(Boolean).join(" · ");
}

function emptyState(text) {
  return `<div class="empty-state"><i data-lucide="coffee"></i><span>${text}</span></div>`;
}

function openCustomize(item) {
  state.currentItem = item;
  const iceConfig = getIceOptionConfig(item);
  state.custom = { sugar: "100%", ice: iceConfig.defaultValue, size: "Regular", extra: false, notes: "" };
  $("#customTitle").textContent = item.name;
  $("#extraTopping").checked = false;
  $("#itemNotes").value = "";
  renderIceOptionGroup(item);
  $$(".option-group").forEach((group) => {
    const key = group.dataset.option;
    group.querySelectorAll(".opt-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.value === state.custom[key]));
  });
  $("#customModal").classList.add("show");
  $("#customModal").setAttribute("aria-hidden", "false");
}

function addToCart() {
  if (!state.currentItem) return;
  const sizeBtn = $('.option-group[data-option="size"] .opt-btn.active');
  const extraTopping = $("#extraTopping").checked;
  const custom = {
    sugar: $('.option-group[data-option="sugar"] .opt-btn.active')?.dataset.value || "100%",
    ice: $('.option-group[data-option="ice"] .opt-btn.active')?.dataset.value || "Normal",
    size: sizeBtn?.dataset.value || "Regular",
    extra: extraTopping,
    notes: $("#itemNotes").value.trim()
  };
  let finalPrice = state.currentItem.price;
  if (custom.size === "Large") finalPrice += Number(sizeBtn?.dataset.extra || 5000);
  if (custom.extra) finalPrice += 5000;

  const existing = state.cart.find((item) =>
    item.id === state.currentItem.id &&
    item.sugar === custom.sugar &&
    item.ice === custom.ice &&
    item.size === custom.size &&
    item.extra === custom.extra &&
    item.notes === custom.notes
  );

  if (existing) existing.qty += 1;
  else state.cart.push({ ...state.currentItem, ...custom, uid: Date.now(), finalPrice, qty: 1 });

  closeModal("#customModal");
  showToast(`${state.currentItem.name} ditambahkan`, "success");
  renderAll();
}

function renderDashboard() {
  const todayOrders = state.orders;
  const sales = todayOrders.reduce((sum, order) => sum + order.total, 0);
  const pending = todayOrders.filter((order) => order.status !== "Completed");
  $("#dashSales").textContent = fmt(sales);
  $("#dashOrders").textContent = todayOrders.length;
  $("#dashPending").textContent = pending.length;
  $("#dashBestSeller").textContent = bestSeller() || "-";
  renderRecentOrders();
}

function bestSeller() {
  const counts = {};
  state.orders.flatMap((order) => order.items).forEach((item) => {
    counts[item.name] = (counts[item.name] || 0) + item.qty;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function renderRecentOrders() {
  $("#recentOrders").innerHTML = state.orders.slice(0, 8).map(orderListRow).join("") || emptyState("Belum ada transaksi hari ini.");
}

function orderListRow(order) {
  return `
    <article class="list-row">
      <div>
        <strong>${order.queue}</strong>
        <span>${order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</span>
        <small>${order.customer} · ${order.type} · ${order.payment}</small>
      </div>
      <div class="row-side">
        <b>${fmt(order.total)}</b>
        <em class="${statusClass(order.status)}">${order.status}</em>
      </div>
    </article>
  `;
}

function statusClass(status) {
  return `status-pill ${String(status).toLowerCase().replace(/\s+/g, "-")}`;
}

function statusKey(status) {
  return String(status).toLowerCase().replace(/\s+/g, "-");
}

function renderOrders() {
  $("#ordersList").innerHTML = state.orders.map(orderListRow).join("") || emptyState("Belum ada order.");
}

function renderKitchen() {
  const statuses = ["New Order", "Preparing", "Ready", "Completed"];
  $("#kitchenBoard").innerHTML = statuses.map((status) => {
    const orders = state.orders.filter((order) => order.status === status);
    return `
      <section class="kitchen-column">
        <h3>${status}</h3>
        <div class="kitchen-stack">
          ${orders.map((order) => kitchenCard(order)).join("") || emptyState("Kosong")}
        </div>
      </section>
    `;
  }).join("");
}

function kitchenCard(order) {
  return `
    <article class="kitchen-card ${statusKey(order.status)}">
      <header><strong>${order.queue}</strong><span>${minutes(order.started)}m</span></header>
      <p>${order.customer} · ${order.type}</p>
      <ul>${order.items.map((item) => `<li>${item.qty}x ${item.name}</li>`).join("")}</ul>
      <small>${order.notes || "Tanpa catatan"}</small>
      ${order.status !== "Completed" ? `<button data-next-status="${order.queue}" type="button">${nextStatusLabel(order.status)}</button>` : '<em>Selesai</em>'}
    </article>
  `;
}

function minutes(time) {
  return Math.max(1, Math.round((Date.now() - time) / 60000));
}

function nextStatus(status) {
  return { "New Order": "Preparing", Preparing: "Ready", Ready: "Completed" }[status];
}

function nextStatusLabel(status) {
  return { "New Order": "Mulai Buat", Preparing: "Siap Diambil", Ready: "Selesai" }[status];
}

function renderMenuAdmin() {
  const categoryOptions = categories().filter((cat) => cat !== "Semua");
  $("#menuAdmin").innerHTML = MENU.map((item) => `
    <article class="admin-card">
      <header>
        <div>
          <strong>${esc(item.name)}</strong>
          <p>${esc(item.cat)} · ${item.best ? "Best Seller" : "Regular"}</p>
        </div>
        <span>${fmt(item.price)}</span>
      </header>
      <label class="field"><span>Nama Menu</span><input data-menu-name="${item.id}" value="${esc(item.name)}" /></label>
      <div class="admin-form-grid">
        <label class="field"><span>Harga</span><input data-menu-price="${item.id}" type="number" min="0" step="1000" value="${item.price}" /></label>
        <label class="field"><span>Kategori</span><input data-menu-cat="${item.id}" list="menuCategoryList" value="${esc(item.cat)}" /></label>
      </div>
      <label class="field"><span>Image URL</span><input data-menu-img="${item.id}" value="${esc(item.img)}" placeholder="https://..." /></label>
      <label class="check-row admin-check"><input data-menu-best="${item.id}" type="checkbox" ${item.best ? "checked" : ""} /> <span>Tandai Best Seller</span></label>
      <div class="inline-actions">
        <button class="mini-btn" data-save-menu="${item.id}" type="button">Simpan</button>
        <button class="mini-btn" data-duplicate-menu="${item.id}" type="button">Duplikat</button>
        <button class="mini-btn ${item.stock ? "" : "danger"}" data-toggle-stock="${item.id}" type="button">${item.stock ? "Stok Ada" : "Stok Habis"}</button>
        <button class="mini-btn danger" data-delete-menu="${item.id}" type="button">Hapus</button>
      </div>
    </article>
  `).join("") + `<datalist id="menuCategoryList">${categoryOptions.map((cat) => `<option value="${esc(cat)}"></option>`).join("")}</datalist>`;
}

function renderPromos() {
  $("#promoGrid").innerHTML = PROMOS.map((promo) => `
    <article class="promo-card">
      <span>${promo.tag}</span>
      <h3>${promo.title}</h3>
      <p>${promo.desc}</p>
      <button class="mini-btn" type="button"><i data-lucide="check"></i>Aktif</button>
    </article>
  `).join("");
}

function renderCustomerDisplay() {
  const totals = cartTotals();
  $("#displayQueue").textContent = nextQueue();
  $("#displayTotal").textContent = fmt(totals.total);
  $("#displayStatus").textContent = state.cart.length ? "Pesanan sedang disiapkan di kasir." : "Silakan cek pesanan di kasir.";
  $("#stampGrid").innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="${i < 8 ? "filled" : ""}"></span>`).join("");
}

async function loadUsers() {
  if (state.user?.role !== USER_ROLES.Admin) {
    state.users = [];
    return;
  }

  try {
    const data = await apiFetch("/api/users");
    state.users = Array.isArray(data.users) ? data.users : [];
  } catch (error) {
    state.users = [];
    showToast("Gagal memuat daftar pengguna", "error");
  }
}

function renderUsersPage() {
  const currentUser = state.user || { username: "-", role: "-" };
  const isAdmin = currentUser.role === USER_ROLES.Admin;
  const userRows = isAdmin ? state.users.map((user) => `
    <div class="panel-row">
      <div>
        <strong>${esc(user.username)}</strong>
        <small>${esc(user.role)}</small>
      </div>
      <div class="form-grid">
        <label class="field"><span>Password Baru</span><input data-user-password="${esc(user.username)}" type="password" placeholder="Isi untuk reset" /></label>
        <button class="mini-btn" data-action="reset-password" data-user="${esc(user.username)}" type="button">Reset Password</button>
      </div>
    </div>
  `).join("") : "";

  $("#usersPage").innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">User Management</p><h2>Pengaturan Akun</h2></div>
    </div>
    <article class="panel">
      <div class="panel-head"><h3>Ganti password Anda</h3></div>
      <div class="form-grid">
        <label class="field"><span>Password Lama</span><input id="currentOldPassword" type="password" /></label>
        <label class="field"><span>Password Baru</span><input id="currentNewPassword" type="password" /></label>
        <div class="inline-actions">
          <button class="mini-btn primary" id="changeOwnPasswordBtn" type="button">Simpan Password</button>
          <span class="form-note">Username: ${esc(currentUser.username)} · Role: ${esc(currentUser.role)}</span>
        </div>
        <p class="login-error" id="currentPasswordError"></p>
      </div>
    </article>
    ${isAdmin ? `
      <article class="panel">
        <div class="panel-head"><h3>Daftar Pengguna</h3></div>
        ${userRows || `<p>Tidak ada pengguna terdaftar.</p>`}
      </article>
    ` : `
      <article class="panel">
        <div class="panel-head"><h3>Akses Terbatas</h3></div>
        <p>Hanya admin yang dapat melihat dan mereset password pengguna lain.</p>
      </article>
    `}
  `;
}

async function handleChangeOwnPassword() {
  const oldPassword = $("#currentOldPassword").value;
  const newPassword = $("#currentNewPassword").value;
  if (!oldPassword || !newPassword) {
    return showActionError("#currentPasswordError", "Isi password lama dan baru terlebih dahulu.");
  }

  try {
    await apiFetch("/api/users", {
      method: "PUT",
      body: JSON.stringify({ oldPassword, newPassword })
    });
    showActionError("#currentPasswordError", "Password berhasil diperbarui.");
    $("#currentOldPassword").value = "";
    $("#currentNewPassword").value = "";
  } catch (error) {
    showActionError("#currentPasswordError", error.message);
  }
}

async function handleResetPassword(username) {
  const input = document.querySelector(`[data-user-password="${username}"]`);
  const newPassword = input?.value || "";
  if (!newPassword) {
    return showToast("Isi password baru terlebih dahulu.", "error");
  }
  try {
    await apiFetch("/api/users", {
      method: "PUT",
      body: JSON.stringify({ username, newPassword })
    });
    showToast(`Password ${username} berhasil direset.`, "success");
    if (input) input.value = "";
  } catch (error) {
    showToast(error.message, "error");
  }
}

function reportOrders() {
  const now = new Date();
  return state.orders.filter((order) => {
    const date = new Date(order.started);
    if (state.reportRange === "daily") return date.toDateString() === now.toDateString();
    if (state.reportRange === "weekly") return now - date <= 7 * 24 * 60 * 60 * 1000;
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
}

function reportDataset(orders = reportOrders()) {
  if (state.reportRange === "daily") {
    const labels = ["08", "10", "12", "14", "16", "18", "20"];
    const values = labels.map((hour) => orders
      .filter((order) => new Date(order.started).getHours() >= Number(hour) && new Date(order.started).getHours() < Number(hour) + 2)
      .reduce((sum, order) => sum + order.total, 0));
    return { title: "Sales Harian", labels, values };
  }
  if (state.reportRange === "weekly") {
    const labels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const values = labels.map((_, index) => orders
      .filter((order) => new Date(order.started).getDay() === index)
      .reduce((sum, order) => sum + order.total, 0));
    return { title: "Sales Mingguan", labels, values };
  }
  const labels = ["M1", "M2", "M3", "M4", "M5"];
  const values = labels.map((_, index) => orders
    .filter((order) => Math.floor((new Date(order.started).getDate() - 1) / 7) === index)
    .reduce((sum, order) => sum + order.total, 0));
  return { title: "Sales Bulanan", labels, values };
}

function renderReports() {
  $$("#reportTabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.report === state.reportRange));
  const orders = reportOrders();
  const gross = orders.reduce((sum, order) => sum + order.total, 0);
  const subtotal = Math.round(gross / (1 + TAX_RATE));
  const tax = gross - subtotal;
  const avg = orders.length ? Math.round(gross / orders.length) : 0;
  const active = orders.filter((order) => order.status !== "Completed").length;
  const dataset = reportDataset(orders);
  $("#chartTitle").textContent = dataset.title;
  $("#reportSummary").innerHTML = `
    <article class="stat-card"><span>Omzet</span><strong>${fmt(gross)}</strong><small>Gross sales periode ini</small></article>
    <article class="stat-card"><span>Transaksi</span><strong>${orders.length}</strong><small>${active} masih aktif</small></article>
    <article class="stat-card"><span>Avg Order</span><strong>${fmt(avg)}</strong><small>per transaksi</small></article>
    <article class="stat-card"><span>Estimasi PPN</span><strong>${fmt(tax)}</strong><small>PPN ${Math.round(TAX_RATE * 100)}%</small></article>
  `;
  $("#reportOrderCount").textContent = `${orders.length} order`;
  renderPaymentMix(orders);
  renderCategorySales(orders);
  renderTopProducts(orders);
  renderReportTable(orders);
  drawChart(dataset);
}

function renderPaymentMix(orders = reportOrders()) {
  const methods = ["QRIS", "Cash", "E-Wallet", "Debit"];
  const total = Math.max(1, orders.length);
  $("#paymentMix").innerHTML = methods.map((method) => {
    const count = orders.filter((order) => order.payment === method).length;
    const amount = orders.filter((order) => order.payment === method).reduce((sum, order) => sum + order.total, 0);
    return `<div><span>${method}<small>${fmt(amount)}</small></span><strong>${Math.round((count / total) * 100)}%</strong></div>`;
  }).join("");
}

function renderCategorySales(orders = reportOrders()) {
  const totals = {};
  orders.flatMap((order) => order.items).forEach((item) => {
    const menu = MENU.find((menuItem) => menuItem.name === item.name);
    const cat = menu?.cat || "Lainnya";
    totals[cat] = (totals[cat] || 0) + item.price * item.qty;
  });
  const max = Math.max(1, ...Object.values(totals));
  $("#categorySales").innerHTML = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => `
    <div class="bar-row"><span>${esc(cat)}</span><b>${fmt(total)}</b><i style="width:${Math.max(8, (total / max) * 100)}%"></i></div>
  `).join("") || emptyState("Belum ada penjualan kategori.");
}

function renderTopProducts(orders = reportOrders()) {
  const totals = {};
  orders.flatMap((order) => order.items).forEach((item) => {
    if (!totals[item.name]) totals[item.name] = { qty: 0, amount: 0 };
    totals[item.name].qty += item.qty;
    totals[item.name].amount += item.price * item.qty;
  });
  $("#topProducts").innerHTML = Object.entries(totals).sort((a, b) => b[1].qty - a[1].qty).slice(0, 6).map(([name, data], index) => `
    <div class="rank-row"><span>${index + 1}</span><strong>${esc(name)}</strong><small>${data.qty} item · ${fmt(data.amount)}</small></div>
  `).join("") || emptyState("Belum ada top menu.");
}

function renderReportTable(orders = reportOrders()) {
  $("#reportTableBody").innerHTML = orders.map((order) => `
    <tr>
      <td>${esc(order.queue)}</td>
      <td>${new Date(order.started).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
      <td>${esc(order.customer)}</td>
      <td>${esc(order.items.map((item) => `${item.qty}x ${item.name}`).join(", "))}</td>
      <td>${esc(order.payment)}</td>
      <td><em class="${statusClass(order.status)}">${esc(order.status)}</em></td>
      <td>${fmt(order.total)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Belum ada transaksi pada periode ini.</td></tr>`;
}

function drawChart(dataset) {
  const canvas = $("#salesChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const values = dataset.values;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(6,47,36,.12)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i += 1) {
    const y = (canvas.height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(36, y);
    ctx.lineTo(canvas.width - 30, y);
    ctx.stroke();
  }
  const max = Math.max(1, ...values);
  const slot = (canvas.width - 100) / values.length;
  values.forEach((value, index) => {
    const height = (value / max) * 220;
    const x = 54 + index * slot;
    const y = canvas.height - height - 42;
    ctx.fillStyle = index === values.length - 2 ? "#d9b24c" : "#1e8e5a";
    roundRect(ctx, x, y, slot * 0.58, height, 12);
    ctx.fill();
    ctx.fillStyle = "#062f24";
    ctx.font = "700 18px DM Sans";
    ctx.fillText(shortMoney(value), x, y - 10);
    ctx.fillStyle = "rgba(6,47,36,.58)";
    ctx.font = "700 14px DM Sans";
    ctx.fillText(dataset.labels[index], x + 4, canvas.height - 15);
  });
}

function shortMoney(value) {
  if (value >= 1000000) return `${Math.round(value / 1000000)}jt`;
  if (value >= 1000) return `${Math.round(value / 1000)}rb`;
  return String(value);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function openPayment() {
  const total = cartTotals().total;
  $("#payTotal").textContent = fmt(total);
  $("#cashInput").value = total;
  $("#paymentError").textContent = "";
  state.payMethod = "Cash";
  updatePaymentMode();
  calculateChange();
  openModal("#paymentModal");
}

function updatePaymentMode() {
  $$(".pay-method").forEach((btn) => btn.classList.toggle("active", btn.dataset.pay === state.payMethod));
  const cash = state.payMethod === "Cash";
  $("#cashField").style.display = cash ? "" : "none";
  $("#changeRow").style.display = cash ? "" : "none";
  $("#noncashBox").classList.toggle("show", !cash);
  const nonCashCopy = { QRIS: ["qr-code", "Scan QRIS"], Debit: ["credit-card", "Gunakan terminal debit"], "E-Wallet": ["smartphone", "Konfirmasi e-wallet"] };
  if (!cash) {
    const [icon, label] = nonCashCopy[state.payMethod];
    $("#noncashBox").innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`;
  }
  iconRefresh();
}

function calculateChange() {
  $("#changeValue").textContent = fmt(Math.max(0, Number($("#cashInput").value || 0) - cartTotals().total));
}

async function completePayment() {
  const total = cartTotals().total;
  if (state.payMethod === "Cash" && Number($("#cashInput").value || 0) < total) {
    $("#paymentError").textContent = "Uang diterima kurang dari total.";
    $("#cashInput").focus();
    return;
  }
  const payload = {
    customer: $("#customerName").value.trim() || "Walk-in Customer",
    type: state.orderType,
    status: "New Order",
    payment: state.payMethod,
    total,
    started: Date.now(),
    items: state.cart.map((item) => ({ name: item.name, qty: item.qty, price: item.finalPrice })),
    notes: state.cart.map((item) => item.notes).filter(Boolean).join(", ")
  };

  try {
    const data = await apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.orders.unshift(data.order);
    state.orderNum = Number.isFinite(data.nextOrderNum) ? data.nextOrderNum : state.orderNum + 1;
    state.cart = [];
    closeModal("#paymentModal");
    renderAll();
    switchPage("kitchen");
    showToast(`Pembayaran berhasil. ${data.order.queue} masuk kitchen`, "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openModal(selector) {
  const modal = $(selector);
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  iconRefresh();
}

function closeModal(selector) {
  const modal = $(selector);
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function exportCsv() {
  const rows = ["Order,Customer,Type,Payment,Total,Status,Items"];
  reportOrders().forEach((order) => {
    rows.push([order.queue, order.customer, order.type, order.payment, order.total, order.status, `"${order.items.map((item) => `${item.qty}x ${item.name}`).join("; ")}"`].join(","));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "starducks-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  if (appEventsBound) return;
  appEventsBound = true;

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.page) switchPage(button.dataset.page);
    if (button.dataset.pageJump) switchPage(button.dataset.pageJump);
    if (button.dataset.cat) {
      state.currentCat = button.dataset.cat;
      renderCategories();
      renderMenuGrid();
    }
    if (button.dataset.item) openCustomize(MENU.find((item) => item.id === Number(button.dataset.item)));
    if (button.dataset.cartAction) handleCartAction(button);
    if (button.dataset.orderType) {
      state.orderType = button.dataset.orderType;
      $$("#orderType button").forEach((btn) => btn.classList.toggle("active", btn === button));
      renderCart();
    }
    if (button.dataset.nextStatus) {
      const order = state.orders.find((item) => item.queue === button.dataset.nextStatus);
      if (order) order.status = nextStatus(order.status);
      renderAll();
    }
    if (button.dataset.toggleStock) {
      const item = MENU.find((menuItem) => menuItem.id === Number(button.dataset.toggleStock));
      if (item) {
        item.stock = !item.stock;
        renderAll();
      }
    }
    if (button.dataset.saveMenu) saveMenu(button.dataset.saveMenu);
    if (button.dataset.duplicateMenu) duplicateMenu(button.dataset.duplicateMenu);
    if (button.dataset.deleteMenu) deleteMenu(button.dataset.deleteMenu);
    if (button.dataset.action === "reset-password") {
      handleResetPassword(button.dataset.user);
    }
    if (button.id === "changeOwnPasswordBtn") {
      handleChangeOwnPassword();
    }
    if (button.dataset.pay) {
      state.payMethod = button.dataset.pay;
      updatePaymentMode();
    }
    if (button.dataset.report) {
      state.reportRange = button.dataset.report;
      renderReports();
    }
  });

  $$(".option-group").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest(".opt-btn");
      if (!button) return;
      group.querySelectorAll(".opt-btn").forEach((btn) => btn.classList.toggle("active", btn === button));
    });
  });

  const globalSearch = $("#globalSearch");
  if (globalSearch) {
    globalSearch.addEventListener("input", (event) => {
      state.query = event.target.value.toLowerCase();
      if (state.page !== "pos") switchPage("pos");
      renderMenuGrid();
    });
  }

  const clearCartBtn = $("#clearCartBtn");
  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      if (!state.cart.length) return;
      state.cart = [];
      renderAll();
      showToast("Keranjang dikosongkan");
    });
  }

  const addToCartBtn = $("#addToCartBtn");
  if (addToCartBtn) addToCartBtn.addEventListener("click", addToCart);

  const customClose = $("#customClose");
  if (customClose) customClose.addEventListener("click", () => closeModal("#customModal"));

  const customModal = $("#customModal");
  if (customModal) customModal.addEventListener("click", (event) => {
    if (event.target.id === "customModal") closeModal("#customModal");
  });

  const payBtn = $("#payBtn");
  if (payBtn) payBtn.addEventListener("click", openPayment);

  const paymentClose = $("#paymentClose");
  if (paymentClose) paymentClose.addEventListener("click", () => closeModal("#paymentModal"));

  const paymentModal = $("#paymentModal");
  if (paymentModal) paymentModal.addEventListener("click", (event) => {
    if (event.target.id === "paymentModal") closeModal("#paymentModal");
  });

  const cashInput = $("#cashInput");
  if (cashInput) cashInput.addEventListener("input", calculateChange);

  const confirmPayBtn = $("#confirmPayBtn");
  if (confirmPayBtn) confirmPayBtn.addEventListener("click", completePayment);

  const exportCsvBtn = $("#exportCsvBtn");
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);

  const printBtn = $("#printBtn");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  const clearCompletedBtn = $("#clearCompletedBtn");
  if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener("click", () => {
      state.orders = state.orders.filter((order) => order.status !== "Completed");
      renderAll();
      showToast("Order completed dibersihkan");
    });
  }

  const logoutBtn = $("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      state.user = null;
      authToken = null;
      const userChip = $("#userChip");
      if (userChip) userChip.textContent = "-";
      lockApp();
    });
  }

  const addMenuBtn = $("#addMenuBtn");
  if (addMenuBtn) {
    addMenuBtn.addEventListener("click", () => {
      const nextId = nextMenuId();
      MENU.push({ id: nextId, name: "Menu Baru Starducks", cat: "Vintage Menu", price: 22000, best: false, stock: true, img: IMAGE_BANK[nextId % IMAGE_BANK.length], color: "linear-gradient(135deg,#062f24,#d9b24c)" });
      renderAll();
      showToast("Menu baru ditambahkan");
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeModal("#customModal");
    closeModal("#paymentModal");
  });
}

function handleCartAction(button) {
  const item = state.cart.find((cartItem) => cartItem.uid === Number(button.dataset.uid));
  if (!item) return;
  if (button.dataset.cartAction === "inc") item.qty += 1;
  if (button.dataset.cartAction === "dec") item.qty -= 1;
  if (button.dataset.cartAction === "del" || item.qty <= 0) state.cart = state.cart.filter((cartItem) => cartItem.uid !== item.uid);
  renderAll();
}

function nextMenuId() {
  return MENU.length ? Math.max(...MENU.map((item) => item.id)) + 1 : 1;
}

function saveMenu(id) {
  const item = MENU.find((menuItem) => menuItem.id === Number(id));
  const nameInput = document.querySelector(`[data-menu-name="${id}"]`);
  const priceInput = document.querySelector(`[data-menu-price="${id}"]`);
  const catInput = document.querySelector(`[data-menu-cat="${id}"]`);
  const imgInput = document.querySelector(`[data-menu-img="${id}"]`);
  const bestInput = document.querySelector(`[data-menu-best="${id}"]`);
  const name = nameInput.value.trim();
  const price = Number(priceInput.value);
  const cat = catInput.value.trim();
  if (!Number.isFinite(price) || price < 0) {
    showToast("Harga belum valid", "error");
    priceInput.focus();
    return;
  }
  if (!name) {
    showToast("Nama menu wajib diisi", "error");
    nameInput.focus();
    return;
  }
  item.name = titleCase(name);
  item.price = Math.round(price);
  item.cat = cat ? normalizeCategory(cat) : "Menu";
  item.img = imgInput.value.trim();
  item.best = bestInput.checked;
  renderAll();
  showToast(`${item.name} diperbarui`, "success");
}

function duplicateMenu(id) {
  const item = MENU.find((menuItem) => menuItem.id === Number(id));
  if (!item) return;
  MENU.push({ ...item, id: nextMenuId(), name: `${item.name} Copy`, best: false });
  renderAll();
  showToast("Menu berhasil diduplikat", "success");
}

function deleteMenu(id) {
  const item = MENU.find((menuItem) => menuItem.id === Number(id));
  if (!item) return;
  MENU.splice(MENU.indexOf(item), 1);
  state.cart = state.cart.filter((cartItem) => cartItem.id !== item.id);
  renderAll();
  showToast(`${item.name} dihapus`, "error");
}

function renderAll() {
  renderCategories();
  renderMenuGrid();
  renderCart();
  renderDashboard();
  renderOrders();
  renderKitchen();
  renderMenuAdmin();
  renderPromos();
  renderCustomerDisplay();
  if (state.page === "users") renderUsersPage();
  if (state.page === "reports") renderReports();
  iconRefresh();
}

function initLogin() {
  console.log("[AUTH] initLogin start");
  const loginForm = $("#loginForm");
  const loginButton = $("#loginBtn");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
    console.log("[AUTH] loginForm submit handler terpasang");
  } else {
    console.error("[AUTH] loginForm tidak ditemukan");
  }
  if (loginButton) {
    loginButton.addEventListener("click", (event) => {
      event.preventDefault();
      handleLogin(event);
    });
    console.log("[AUTH] loginBtn click handler terpasang");
  } else {
    console.error("[AUTH] loginBtn tidak ditemukan");
  }
  lockApp();
}

async function init() {
  $("#pageDate").textContent = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  setInterval(() => {
    $("#clockDisplay").textContent = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }, 1000);
  $("#clockDisplay").textContent = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  initLogin();
}

window.addEventListener("load", init);
