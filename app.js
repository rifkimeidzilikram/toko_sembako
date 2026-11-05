(() => {
  "use strict";

  const products = typeof PRODUCTS_DATA !== "undefined" && Array.isArray(PRODUCTS_DATA) ? PRODUCTS_DATA : [];
  const store = typeof STORE_CONFIG !== "undefined" ? STORE_CONFIG : {};
  const cartKey = "berkah-jaya-cart-v1";
  const formatPrice = (amount) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const state = {
    category: "semua",
    query: "",
    sort: "popular",
    cart: readCart()
  };

  const elements = {
    grid: document.getElementById("product-grid"),
    search: document.getElementById("product-search"),
    categories: document.getElementById("category-list"),
    sort: document.getElementById("sort-products"),
    results: document.getElementById("results-label"),
    empty: document.getElementById("empty-state"),
    cartCount: document.getElementById("cart-count"),
    drawerCount: document.getElementById("drawer-count"),
    drawer: document.getElementById("cart-drawer"),
    cartItems: document.getElementById("cart-items"),
    cartEmpty: document.getElementById("cart-empty"),
    cartSummary: document.getElementById("cart-summary"),
    toast: document.getElementById("toast")
  };

  function readCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(cartKey) || "[]");
      if (!Array.isArray(saved)) return {};
      return saved.reduce((cart, item) => {
        const product = products.find((entry) => entry.id === Number(item.id));
        const quantity = Math.floor(Number(item.quantity));
        if (product && Number.isFinite(quantity) && quantity > 0) {
          cart[product.id] = Math.min(quantity, product.stock);
        }
        return cart;
      }, {});
    } catch (error) {
      console.warn("Keranjang tersimpan tidak dapat dibaca.", error);
      return {};
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(cartKey, JSON.stringify(
        Object.entries(state.cart).map(([id, quantity]) => ({ id: Number(id), quantity }))
      ));
    } catch (error) {
      console.warn("Keranjang tidak dapat disimpan di perangkat ini.", error);
    }
  }

  function getVisibleProducts() {
    let visible = products.filter((product) => {
      const matchesCategory = state.category === "semua" || product.category === state.category;
      const query = state.query.trim().toLocaleLowerCase("id-ID");
      const matchesQuery = !query || `${product.name} ${product.categoryName} ${product.desc}`.toLocaleLowerCase("id-ID").includes(query);
      return matchesCategory && matchesQuery;
    });

    if (state.sort === "price-low") visible = visible.sort((a, b) => a.price - b.price);
    if (state.sort === "price-high") visible = visible.sort((a, b) => b.price - a.price);
    if (state.sort === "name") visible = visible.sort((a, b) => a.name.localeCompare(b.name, "id"));
    if (state.sort === "popular") visible = visible.sort((a, b) => b.soldCount - a.soldCount);
    return visible;
  }

  function renderProducts() {
    const visible = getVisibleProducts();
    elements.grid.innerHTML = visible.map((product) => `
      <article class="product-card">
        <div class="product-image-wrap">
          <img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
          ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
        </div>
        <div class="product-content">
          <p class="product-category">${escapeHtml(product.categoryName)}</p>
          <h3 class="product-name">${escapeHtml(product.name)}</h3>
          <p class="product-unit">${escapeHtml(product.unit)}</p>
          <div class="product-price-row"><span class="product-price">${formatPrice(product.price)}</span>
            ${product.originalPrice > product.price ? `<span class="product-original">${formatPrice(product.originalPrice)}</span>` : ""}
          </div>
          <div class="product-meta"><span class="product-rating">★ ${Number(product.rating).toFixed(1)} <span>(${product.soldCount} terjual)</span></span><span>Stok ${product.stock}</span></div>
          <button class="add-button" type="button" data-add="${product.id}" ${product.stock < 1 ? "disabled" : ""}>
            <span aria-hidden="true">＋</span> ${product.stock < 1 ? "Stok habis" : "Tambah ke keranjang"}
          </button>
        </div>
      </article>
    `).join("");
    elements.empty.hidden = visible.length > 0;
    elements.grid.hidden = visible.length === 0;
    elements.results.textContent = state.query || state.category !== "semua"
      ? `Menampilkan ${visible.length} produk`
      : `Menampilkan semua ${visible.length} produk`;
  }

  function cartEntries() {
    return Object.entries(state.cart)
      .map(([id, quantity]) => ({ product: products.find((item) => item.id === Number(id)), quantity }))
      .filter((entry) => entry.product && entry.quantity > 0);
  }

  function renderCart() {
    const entries = cartEntries();
    const quantityTotal = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const subtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
    const deliveryFee = subtotal === 0 || subtotal >= store.freeDeliveryMin ? 0 : store.deliveryFee;

    elements.cartCount.textContent = quantityTotal > 99 ? "99+" : String(quantityTotal);
    elements.drawerCount.textContent = `(${quantityTotal})`;
    elements.cartItems.innerHTML = entries.map(({ product, quantity }) => `
      <div class="cart-line">
        <img src="${escapeHtml(product.image)}" alt="" loading="lazy">
        <div>
          <p class="cart-line-name">${escapeHtml(product.name)}</p>
          <p class="cart-line-price">${formatPrice(product.price * quantity)}</p>
          <div class="quantity-control">
            <button type="button" data-quantity="${product.id}" data-change="-1" aria-label="Kurangi ${escapeHtml(product.name)}">−</button>
            <span>${quantity}</span>
            <button type="button" data-quantity="${product.id}" data-change="1" aria-label="Tambah ${escapeHtml(product.name)}" ${quantity >= product.stock ? "disabled" : ""}>+</button>
          </div>
        </div>
        <button class="remove-item" type="button" data-remove="${product.id}" aria-label="Hapus ${escapeHtml(product.name)}">×</button>
      </div>
    `).join("");

    const isEmpty = entries.length === 0;
    elements.cartEmpty.style.display = isEmpty ? "flex" : "none";
    elements.cartSummary.hidden = isEmpty;
    document.getElementById("cart-subtotal").textContent = formatPrice(subtotal);
    document.getElementById("cart-delivery").textContent = deliveryFee === 0 && subtotal > 0 ? "Gratis" : formatPrice(deliveryFee);
    document.getElementById("cart-total").textContent = formatPrice(subtotal + deliveryFee);
    document.getElementById("delivery-message").textContent = subtotal >= store.freeDeliveryMin
      ? "Yeay! Kamu mendapatkan gratis ongkir."
      : `Belanja ${formatPrice(store.freeDeliveryMin - subtotal)} lagi untuk mendapatkan gratis ongkir.`;
  }

  function updateCart(productId, change) {
    const product = products.find((entry) => entry.id === Number(productId));
    if (!product) return;
    const nextQuantity = (state.cart[product.id] || 0) + change;
    if (nextQuantity <= 0) delete state.cart[product.id];
    else state.cart[product.id] = Math.min(nextQuantity, product.stock);
    saveCart();
    renderCart();
  }

  let toastTimer;
  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 2300);
  }

  function setCartOpen(open) {
    document.body.classList.toggle("cart-open", open);
    elements.drawer.setAttribute("aria-hidden", String(!open));
    if (open) document.getElementById("close-cart").focus();
  }

  function whatsappUrl(message) {
    const number = String(store.whatsappNumber || "").replace(/\D/g, "");
    if (!number) {
      showToast("Nomor WhatsApp toko belum diatur.");
      return null;
    }
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function configureStore() {
    document.title = `${store.name || "Toko Sembako"} | Lengkap, Hemat, Siap Antar`;
    document.getElementById("announcement-delivery").textContent = `Gratis ongkir untuk belanja minimal ${formatPrice(store.freeDeliveryMin)}`;
    document.getElementById("store-address").textContent = store.address || "Alamat toko belum tersedia";
    document.getElementById("store-hours").textContent = store.operatingHours || "Hubungi toko untuk informasi jam buka";
    const phone = document.getElementById("store-phone");
    phone.textContent = store.phone || "Hubungi toko";
    phone.href = store.phone ? `tel:${String(store.phone).replace(/[^\d+]/g, "")}` : "#";
    document.getElementById("year").textContent = new Date().getFullYear();

    const message = `Halo ${store.name || "Toko"}, saya ingin bertanya tentang produk sembako.`;
    const url = whatsappUrl(message);
    if (url) {
      document.getElementById("contact-whatsapp").href = url;
      document.getElementById("footer-whatsapp").href = url;
    }
    document.getElementById("all-count").textContent = String(products.length);
  }

  elements.grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    const product = products.find((entry) => entry.id === Number(button.dataset.add));
    if (!product) return;
    if ((state.cart[product.id] || 0) >= product.stock) {
      showToast("Jumlah pesanan sudah mencapai stok yang tersedia.");
      return;
    }
    updateCart(product.id, 1);
    showToast(`${product.name} ditambahkan ke keranjang.`);
  });

  elements.categories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    elements.categories.querySelectorAll(".category-chip").forEach((chip) => {
      const selected = chip === button;
      chip.classList.toggle("active", selected);
      chip.setAttribute("aria-pressed", String(selected));
    });
    renderProducts();
  });

  elements.search.addEventListener("input", () => {
    state.query = elements.search.value;
    renderProducts();
  });

  elements.sort.addEventListener("change", () => {
    state.sort = elements.sort.value;
    renderProducts();
  });

  elements.cartItems.addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-quantity]");
    if (quantityButton) updateCart(quantityButton.dataset.quantity, Number(quantityButton.dataset.change));
    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      delete state.cart[Number(removeButton.dataset.remove)];
      saveCart();
      renderCart();
    }
  });

  document.getElementById("open-cart").addEventListener("click", () => setCartOpen(true));
  document.getElementById("close-cart").addEventListener("click", () => setCartOpen(false));
  document.getElementById("drawer-backdrop").addEventListener("click", () => setCartOpen(false));
  document.getElementById("start-shopping").addEventListener("click", () => setCartOpen(false));
  document.getElementById("reset-search").addEventListener("click", () => {
    state.query = "";
    state.category = "semua";
    elements.search.value = "";
    elements.categories.querySelectorAll(".category-chip").forEach((chip) => {
      const selected = chip.dataset.category === "semua";
      chip.classList.toggle("active", selected);
      chip.setAttribute("aria-pressed", String(selected));
    });
    renderProducts();
  });
  document.getElementById("checkout-button").addEventListener("click", () => {
    const entries = cartEntries();
    if (!entries.length) return;
    const subtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
    const deliveryFee = subtotal >= store.freeDeliveryMin ? 0 : store.deliveryFee;
    const lines = entries.map(({ product, quantity }) => `- ${product.name} x${quantity}: ${formatPrice(product.price * quantity)}`);
    const message = [
      `Halo ${store.name || "Toko Sembako Berkah Jaya"}, saya ingin memesan:`,
      "",
      ...lines,
      "",
      `Subtotal: ${formatPrice(subtotal)}`,
      `Ongkos kirim: ${deliveryFee ? formatPrice(deliveryFee) : "Gratis"}`,
      `Total: ${formatPrice(subtotal + deliveryFee)}`,
      "",
      "Mohon konfirmasi ketersediaan dan detail pengiriman. Terima kasih."
    ].join("\n");
    const url = whatsappUrl(message);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  });

  document.getElementById("menu-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    document.getElementById("main-nav").classList.toggle("open", open);
  });
  document.querySelectorAll(".main-nav .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.getElementById("main-nav").classList.remove("open");
      document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setCartOpen(false);
  });

  configureStore();
  renderProducts();
  renderCart();
})();
