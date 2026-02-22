let products = [];
let categories = {};
let cart = JSON.parse(localStorage.getItem('trendCart')) || [];
let wishlist = JSON.parse(localStorage.getItem('trendWishlist')) || [];
let compareList = JSON.parse(localStorage.getItem('trendCompare')) || [];
let activeMainCategory = null;
let activeSubCategory = null;
let clientUser = null;

const productsGrid = document.getElementById('productsGrid');
const cartBtn = document.getElementById('cartBtn');
const cartSidebar = document.getElementById('cartSidebar');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const searchInput = document.getElementById('searchInput');
const productModal = document.getElementById('productModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');
const categoryButtonsContainer = document.getElementById('categoryButtons');

async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        categories = await res.json();
    } catch { categories = {}; }
}

async function loadProducts(query) {
    try {
        let url = '/api/products';
        if (query) url += '?' + new URLSearchParams(query).toString();
        const res = await fetch(url);
        products = await res.json();
    } catch { products = []; }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadProducts();
    await checkClientAuth();
    buildMainCategoryButtons();
    renderProducts(products);
    updateCartUI();
    updateWishlistUI();
    updateCompareUI();
    setupEventListeners();
    setupAuthListeners();
});

function buildMainCategoryButtons() {
    if (!categoryButtonsContainer) return;
    categoryButtonsContainer.innerHTML = '';
    const allBtn = btn('all', 'main', 'fa-th-large', 'Të Gjitha', true);
    categoryButtonsContainer.appendChild(allBtn);
    Object.keys(categories).forEach(key => {
        const cat = categories[key];
        categoryButtonsContainer.appendChild(btn(key, 'main', cat.icon, cat.name));
    });
    attachCategoryListeners();
}

function buildSubCategoryButtons(mainCatKey) {
    if (!categoryButtonsContainer) return;
    categoryButtonsContainer.innerHTML = '';
    const cat = categories[mainCatKey];
    if (!cat) return;
    categoryButtonsContainer.appendChild(btn('back', 'back', 'fa-arrow-left', 'Kthehu'));
    categoryButtonsContainer.appendChild(btn(mainCatKey, 'all-sub', cat.icon, 'Të Gjitha ' + cat.name, true));
    Object.keys(cat.subcategories || {}).forEach(subKey => {
        const sub = cat.subcategories[subKey];
        const b = btn(subKey, 'sub', sub.icon, sub.name);
        b.dataset.parent = mainCatKey;
        categoryButtonsContainer.appendChild(b);
    });
    attachCategoryListeners();
}

function btn(filter, type, icon, label, active) {
    const b = document.createElement('button');
    b.className = 'category-btn' + (active ? ' active' : '') + (type === 'back' ? ' back-btn' : '');
    b.dataset.filter = filter;
    b.dataset.type = type;
    b.innerHTML = `<i class="fas ${icon}"></i><span>${label}</span>`;
    return b;
}

function scrollToProducts() {
    const grid = document.getElementById('productsGrid');
    if (grid) {
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function attachCategoryListeners() {
    document.querySelectorAll('.category-btn').forEach(b => {
        b.addEventListener('click', async () => {
            const type = b.dataset.type, filter = b.dataset.filter;
            if (type === 'back') {
                activeMainCategory = null; activeSubCategory = null;
                await loadProducts();
                buildMainCategoryButtons();
                renderProducts(products);
                updateCategoryTitle('Kërko Produkte', 'Zgjidh kategorinë për të parë produktet e disponueshme');
                scrollToProducts();
                return;
            }
            document.querySelectorAll('.category-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            if (type === 'main') {
                if (filter === 'all') {
                    activeMainCategory = null; activeSubCategory = null;
                    await loadProducts();
                    renderProducts(products);
                    updateCategoryTitle('Kërko Produkte', 'Zgjidh kategorinë për të parë produktet e disponueshme');
                } else {
                    activeMainCategory = filter; activeSubCategory = null;
                    await loadProducts({ mainCategory: filter });
                    buildSubCategoryButtons(filter);
                    renderProducts(products);
                    updateCategoryTitle(categories[filter].name, `Zgjidh nën-kategorinë e ${categories[filter].name.toLowerCase()}`);
                }
            } else if (type === 'all-sub') {
                activeSubCategory = null;
                await loadProducts({ mainCategory: filter });
                renderProducts(products);
            } else if (type === 'sub') {
                activeSubCategory = filter;
                await loadProducts({ subCategory: filter });
                renderProducts(products);
            }
            scrollToProducts();
        });
    });
}

function updateCategoryTitle(title, subtitle) {
    const t = document.getElementById('categoryTitle');
    const s = document.getElementById('categorySubtitle');
    if (t) t.textContent = title;
    if (s) s.textContent = subtitle;
}

function setupEventListeners() {
    cartBtn.addEventListener('click', () => cartSidebar.classList.add('open'));
    closeCart.addEventListener('click', () => cartSidebar.classList.remove('open'));
    checkoutBtn.addEventListener('click', handleCheckout);
    searchInput.addEventListener('input', (e) => searchProducts(e.target.value));
    closeModal.addEventListener('click', () => productModal.classList.remove('show'));
    productModal.addEventListener('click', (e) => { if (e.target === productModal) productModal.classList.remove('show'); });

    document.getElementById('wishlistBtn').addEventListener('click', () => document.getElementById('wishlistSidebar').classList.add('open'));
    document.getElementById('closeWishlist').addEventListener('click', () => document.getElementById('wishlistSidebar').classList.remove('open'));
    document.getElementById('compareBtn').addEventListener('click', () => document.getElementById('compareSidebar').classList.add('open'));
    document.getElementById('closeCompare').addEventListener('click', () => document.getElementById('compareSidebar').classList.remove('open'));
    document.getElementById('authLink').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('authModal').classList.add('show'); });
    document.getElementById('authClose').addEventListener('click', () => document.getElementById('authModal').classList.remove('show'));
    document.getElementById('authModal').addEventListener('click', (e) => { if (e.target.id === 'authModal') e.target.classList.remove('show'); });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            if (this.classList.contains('dropdown-item')) return;
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            const category = this.dataset.category;
            activeMainCategory = category; activeSubCategory = null;
            await loadProducts({ mainCategory: category });
            const cat = categories[category];
            if (cat) {
                buildSubCategoryButtons(category);
                renderProducts(products);
                updateCategoryTitle(cat.name, `Zgjidh nën-kategorinë e ${cat.name.toLowerCase()}`);
            }
            scrollToProducts();
        });
    });

    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Faleminderit për mesazhin tuaj! Do t\'ju kontaktojmë së shpejti.');
            contactForm.reset();
        });
    }
}

function renderProducts(list) {
    productsGrid.innerHTML = '';
    if (list.length === 0) {
        productsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;"><i class="fas fa-search" style="font-size:3rem;color:#9ca3af;margin-bottom:1rem;display:block;"></i><p style="font-size:1.25rem;color:#6b7280;">Nuk u gjetën produkte</p></div>';
        return;
    }
    list.forEach(p => productsGrid.appendChild(createProductCard(p)));
}

function getCategoryDisplayName(product) {
    const mainKey = product.main_category_key || product.mainCategory;
    const subKey = product.sub_category_key || product.category;
    if (categories[mainKey]?.subcategories?.[subKey]) return categories[mainKey].subcategories[subKey].name;
    return subKey || '';
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const badge = product.type === 'premium' ? '<span class="product-badge">Premium</span>' : '';
    const catName = getCategoryDisplayName(product);
    const icon = product.icon || 'fa-box';
    const img = product.image ? `<img src="${product.image}" alt="${product.name}">` : `<i class="fas ${icon}"></i>`;

    const isWished = wishlist.includes(product.id);
    const isCompared = compareList.includes(product.id);

    const stock = product.stock ?? 0;
    const stockBadge = stock === 0
        ? '<span class="stock-badge stock-out"><i class="fas fa-times-circle"></i> Jashtë Stokut</span>'
        : stock <= (product.stock_min || 5)
            ? `<span class="stock-badge stock-low"><i class="fas fa-exclamation-circle"></i> Vetëm ${stock} copë</span>`
            : '<span class="stock-badge stock-available"><i class="fas fa-check-circle"></i> Në Gjendje</span>';
    const cartBtn = stock === 0
        ? '<button class="add-to-cart disabled" disabled><i class="fas fa-ban"></i> S\'ka</button>'
        : `<button class="add-to-cart" onclick="addToCart(${product.id})"><i class="fas fa-cart-plus"></i> Shto</button>`;

    card.innerHTML = `
        <div class="product-image">
            ${badge}
            <div class="product-actions">
                <button class="product-action-btn ${isWished ? 'active' : ''}" onclick="event.stopPropagation(); toggleWishlist(${product.id})" title="Lista e dëshirave"><i class="fas fa-heart"></i></button>
                <button class="product-action-btn ${isCompared ? 'active' : ''}" onclick="event.stopPropagation(); toggleCompare(${product.id})" title="Krahaso"><i class="fas fa-exchange-alt"></i></button>
            </div>
            ${img}
        </div>
        <div class="product-info">
            <div class="product-category">${catName}</div>
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description || ''}</p>
            ${stockBadge}
            <div class="product-footer">
                <div class="product-price">${formatPrice(product.price)}</div>
                ${cartBtn}
            </div>
        </div>`;
    card.addEventListener('click', (e) => { if (!e.target.closest('.add-to-cart') && !e.target.closest('.product-action-btn')) showProductModal(product); });
    return card;
}

function showProductModal(product) {
    const catName = getCategoryDisplayName(product);
    const icon = product.icon || 'fa-box';
    const img = product.image ? `<img src="${product.image}" alt="${product.name}">` : `<i class="fas ${icon}" style="font-size:8rem;opacity:0.6;"></i>`;
    const features = Array.isArray(product.features) ? product.features : [];

    const stock = product.stock ?? 0;
    const stockInfo = stock === 0
        ? '<div class="modal-stock stock-out"><i class="fas fa-times-circle"></i> Jashtë Stokut</div>'
        : stock <= (product.stock_min || 5)
            ? `<div class="modal-stock stock-low"><i class="fas fa-exclamation-circle"></i> Vetëm ${stock} copë të mbetura</div>`
            : '<div class="modal-stock stock-available"><i class="fas fa-check-circle"></i> Në Gjendje</div>';
    const modalCartBtn = stock === 0
        ? '<button class="btn" style="background:#ccc;color:#666;cursor:not-allowed;" disabled><i class="fas fa-ban"></i> Jashtë Stokut</button>'
        : `<button class="btn btn-primary" style="background:var(--primary-color);color:white;" onclick="addToCart(${product.id}); productModal.classList.remove('show');"><i class="fas fa-cart-plus"></i> Shto në Shportë</button>`;

    modalBody.innerHTML = `
        <div class="modal-product">
            <div class="modal-product-image">${img}</div>
            <div class="modal-product-info">
                <div class="product-category">${catName}</div>
                <h2>${product.name}</h2>
                <div class="product-price">${formatPrice(product.price)}</div>
                ${stockInfo}
                <p class="modal-product-description">${product.description || ''}</p>
                <ul class="modal-product-features">${features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}</ul>
                ${modalCartBtn}
            </div>
        </div>`;
    productModal.classList.add('show');
}

function searchProducts(query) {
    const term = query.toLowerCase().trim();
    if (!term) { renderProducts(products); return; }
    const filtered = products.filter(p => p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term));
    renderProducts(filtered);
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if ((product.stock ?? 0) === 0) { showNotification('Produkti është jashtë stokut!'); return; }
    const existing = cart.find(i => i.id === productId);
    if (existing) {
        if (existing.quantity >= product.stock) { showNotification(`Vetëm ${product.stock} copë në stok!`); return; }
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    saveCart(); updateCartUI(); showNotification('Produkti u shtua në shportë!');
}
function removeFromCart(id) { cart = cart.filter(i => i.id !== id); saveCart(); updateCartUI(); }
function updateQuantity(id, change) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) removeFromCart(id);
    else { saveCart(); updateCartUI(); }
}

function updateCartUI() {
    cartCount.textContent = cart.reduce((s, i) => s + i.quantity, 0);
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart"><i class="fas fa-shopping-cart"></i><p>Shporta juaj është e zbrazët</p></div>';
        cartTotal.textContent = '0';
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-image"><i class="fas ${item.icon || 'fa-box'}"></i></div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${formatPrice(item.price)}</div>
                    <div class="cart-item-actions">
                        <button class="quantity-btn" onclick="updateQuantity(${item.id},-1)">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity(${item.id},1)">+</button>
                        <button class="remove-item" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>`).join('');
        cartTotal.textContent = formatPrice(cart.reduce((s, i) => s + i.price * i.quantity, 0));
    }
}

function handleCheckout() {
    if (!cart.length) { alert('Shporta juaj është e zbrazët!'); return; }
    cartSidebar.classList.remove('open');
    showCheckoutModal();
}

function showCheckoutModal() {
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = subtotal >= 100 ? 0 : 5;
    const total = subtotal + shipping;

    const pmStyle = `display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;border:2px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .2s;`;
    const pmActiveStyle = `border-color:#9B1B1B;background:#fef2f2;`;

    const modal = document.createElement('div');
    modal.id = 'checkoutModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:5000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;padding:2rem;position:relative;">
            <button onclick="document.getElementById('checkoutModal').remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#6b7280;">&times;</button>
            <h2 style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:#1a1a2e;margin-bottom:.5rem;"><i class="fas fa-shopping-bag" style="color:#9B1B1B;"></i> Përfundo Porosinë</h2>
            <p style="color:#6b7280;margin-bottom:1.5rem;font-size:.9rem;">Plotëso të dhënat për dërgesë</p>

            <form id="checkoutForm">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
                    <div class="auth-field"><label>Emri i plotë *</label>
                        <input type="text" id="coName" required value="${clientUser ? clientUser.name : ''}" placeholder="Emri Mbiemri" style="width:100%;padding:.6rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;"></div>
                    <div class="auth-field"><label>Telefoni *</label>
                        <input type="tel" id="coPhone" required placeholder="+383 49 ..." style="width:100%;padding:.6rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;"></div>
                </div>
                <div class="auth-field" style="margin-top:.75rem;"><label>Email *</label>
                    <input type="email" id="coEmail" required value="${clientUser ? clientUser.email : ''}" placeholder="email@shembull.com" style="width:100%;padding:.6rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.75rem;">
                    <div class="auth-field"><label>Shteti</label>
                        <select id="coCountry" style="width:100%;padding:.6rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;">
                            <option value="XK" selected>Kosovë</option><option value="AL">Shqipëri</option><option value="MK">Maqedoni</option>
                            <option value="ME">Mal i Zi</option><option value="DE">Gjermani</option><option value="CH">Zvicër</option><option value="AT">Austri</option>
                        </select></div>
                    <div class="auth-field"><label>Qyteti *</label>
                        <input type="text" id="coCity" required placeholder="Qyteti" style="width:100%;padding:.6rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;"></div>
                </div>
                <div class="auth-field" style="margin-top:.75rem;"><label>Adresa e plotë *</label>
                    <input type="text" id="coAddress" required placeholder="Rruga, numri, kodi postal..." style="width:100%;padding:.6rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;"></div>
                <div class="auth-field" style="margin-top:.75rem;"><label>Shënime (opsionale)</label>
                    <textarea id="coNotes" rows="2" placeholder="Shënime shtesë për porosinë..." style="width:100%;padding:.6rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9rem;resize:vertical;"></textarea></div>

                <!-- Payment Method Selection -->
                <div style="margin-top:1.5rem;">
                    <h3 style="font-size:1rem;margin-bottom:.75rem;color:#1a1a2e;"><i class="fas fa-credit-card" style="color:#9B1B1B;"></i> Mënyra e Pagesës</h3>
                    <div style="display:flex;flex-direction:column;gap:.5rem;" id="paymentMethods">
                        <label id="pmCod" style="${pmStyle}${pmActiveStyle}" onclick="selectPayment('cod')">
                            <input type="radio" name="payment_method" value="cod" checked style="display:none;">
                            <div style="width:42px;height:42px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-money-bill-wave" style="color:#16a34a;font-size:1.1rem;"></i></div>
                            <div style="flex:1;"><strong style="font-size:.9rem;">Para në Dorë (COD)</strong><p style="font-size:.78rem;color:#6b7280;margin:0;">Paguani kur t'ju dorëzohet porosia</p></div>
                        </label>
                        <label id="pmBank" style="${pmStyle}" onclick="selectPayment('bank')">
                            <input type="radio" name="payment_method" value="bank" style="display:none;">
                            <div style="width:42px;height:42px;border-radius:10px;background:#dbeafe;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-university" style="color:#3b82f6;font-size:1.1rem;"></i></div>
                            <div style="flex:1;"><strong style="font-size:.9rem;">Transfertë Bankare</strong><p style="font-size:.78rem;color:#6b7280;margin:0;">Paguani me transfertë para dërgesës</p></div>
                        </label>
                        <label id="pmCard" style="${pmStyle}" onclick="selectPayment('card')">
                            <input type="radio" name="payment_method" value="card" style="display:none;">
                            <div style="width:42px;height:42px;border-radius:10px;background:#fef3c7;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-credit-card" style="color:#f59e0b;font-size:1.1rem;"></i></div>
                            <div style="flex:1;"><strong style="font-size:.9rem;">Pagesë me Kartë</strong><p style="font-size:.78rem;color:#6b7280;margin:0;">Paguani menjëherë me kartë krediti/debiti</p></div>
                        </label>
                    </div>
                    <div id="bankDetails" style="display:none;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:1rem;margin-top:.75rem;font-size:.85rem;">
                        <p style="font-weight:600;margin-bottom:.5rem;color:#1e40af;"><i class="fas fa-info-circle"></i> Detajet Bankare</p>
                        <p><strong>Banka:</strong> [Emri i Bankës]</p>
                        <p><strong>IBAN:</strong> XK00 0000 0000 0000 0000</p>
                        <p><strong>Përfituesi:</strong> TREND COMPANY SH.P.K.</p>
                        <p style="color:#6b7280;margin-top:.5rem;font-size:.8rem;">Shkruani numrin e porosisë si referencë në transfertë.</p>
                    </div>
                </div>

                <div style="background:#f8f9fa;border-radius:12px;padding:1rem;margin-top:1.25rem;">
                    <h3 style="font-size:1rem;margin-bottom:.75rem;color:#1a1a2e;">Përmbledhja e Porosisë</h3>
                    ${cart.map(item => `<div style="display:flex;justify-content:space-between;padding:.3rem 0;font-size:.85rem;color:#4b5563;">
                        <span>${item.name} × ${item.quantity}</span><span>${formatPrice(item.price * item.quantity)}</span>
                    </div>`).join('')}
                    <hr style="margin:.75rem 0;border-color:#e5e7eb;">
                    <div style="display:flex;justify-content:space-between;font-size:.85rem;color:#6b7280;"><span>Nëntotali</span><span>${formatPrice(subtotal)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:.85rem;color:#6b7280;margin-top:.25rem;"><span>Dërgesa</span><span>${shipping === 0 ? '<span style="color:#16a34a;">FALAS</span>' : formatPrice(shipping)}</span></div>
                    <hr style="margin:.75rem 0;border-color:#e5e7eb;">
                    <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700;color:#1a1a2e;"><span>TOTALI</span><span style="color:#9B1B1B;">${formatPrice(total)}</span></div>
                </div>

                <button type="submit" id="coSubmitBtn" style="width:100%;padding:.9rem;background:#9B1B1B;color:white;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;margin-top:1.25rem;font-family:'Montserrat',sans-serif;transition:background .3s;">
                    <i class="fas fa-check-circle"></i> Konfirmo Porosinë
                </button>
            </form>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('coSubmitBtn');
        const selectedPm = document.querySelector('input[name="payment_method"]:checked').value;
        btn.textContent = selectedPm === 'card' ? 'Duke ridrejtuar në pagesë...' : 'Duke dërguar porosinë...';
        btn.disabled = true;

        try {
            const orderData = {
                customer_name: document.getElementById('coName').value,
                customer_email: document.getElementById('coEmail').value,
                customer_phone: document.getElementById('coPhone').value,
                customer_city: document.getElementById('coCity').value,
                customer_country: document.getElementById('coCountry').value,
                customer_address: document.getElementById('coAddress').value,
                notes: document.getElementById('coNotes').value,
                payment_method: selectedPm,
                items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, image: i.image || '' }))
            };

            const res = await fetch('/api/orders', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                credentials: 'include', body: JSON.stringify(orderData)
            });
            const data = await res.json();

            if (data.success) {
                if (selectedPm === 'card') {
                    const stripeRes = await fetch('/api/stripe/create-session', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'include', body: JSON.stringify({ order_id: data.order_id })
                    });
                    const stripeData = await stripeRes.json();
                    if (stripeData.url) {
                        cart = []; saveCart(); updateCartUI();
                        window.location.href = stripeData.url;
                        return;
                    } else {
                        modal.remove();
                        cart = []; saveCart(); updateCartUI();
                        showOrderSuccess(data.order_number, data.total, 'card_no_stripe');
                    }
                } else {
                    modal.remove();
                    cart = []; saveCart(); updateCartUI();
                    showOrderSuccess(data.order_number, data.total, selectedPm);
                }
            } else {
                alert(data.error || 'Gabim gjatë porosisë');
                btn.innerHTML = '<i class="fas fa-check-circle"></i> Konfirmo Porosinë';
                btn.disabled = false;
            }
        } catch (err) {
            alert('Gabim në lidhje me serverin. Provo përsëri.');
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Konfirmo Porosinë';
            btn.disabled = false;
        }
    });
}

window.selectPayment = function(method) {
    document.querySelectorAll('#paymentMethods label').forEach(l => {
        l.style.borderColor = '#e5e7eb';
        l.style.background = 'white';
    });
    const el = document.getElementById('pm' + method.charAt(0).toUpperCase() + method.slice(1));
    if (el) {
        el.style.borderColor = '#9B1B1B';
        el.style.background = '#fef2f2';
        el.querySelector('input').checked = true;
    }
    document.getElementById('bankDetails').style.display = method === 'bank' ? 'block' : 'none';
    const btn = document.getElementById('coSubmitBtn');
    if (method === 'card') btn.innerHTML = '<i class="fas fa-credit-card"></i> Paguaj me Kartë';
    else if (method === 'bank') btn.innerHTML = '<i class="fas fa-university"></i> Konfirmo Porosinë (Transfertë)';
    else btn.innerHTML = '<i class="fas fa-check-circle"></i> Konfirmo Porosinë';
};

function showOrderSuccess(orderNumber, total, paymentMethod) {
    let paymentNote = 'Do t\'ju kontaktojmë në telefon për konfirmim të porosisë.';
    let extraInfo = '';

    if (paymentMethod === 'bank') {
        paymentNote = 'Ju lutem kryeni transfertën bankare brenda 48 orëve.';
        extraInfo = `
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:1rem;margin-bottom:1rem;text-align:left;font-size:.85rem;">
                <p style="font-weight:600;color:#1e40af;margin-bottom:.5rem;"><i class="fas fa-university"></i> Detajet Bankare</p>
                <p><strong>Banka:</strong> [Emri i Bankës]</p>
                <p><strong>IBAN:</strong> XK00 0000 0000 0000 0000</p>
                <p><strong>Përfituesi:</strong> TREND COMPANY SH.P.K.</p>
                <p style="color:#6b7280;margin-top:.5rem;"><strong>Referenca:</strong> ${orderNumber}</p>
            </div>`;
    } else if (paymentMethod === 'card_no_stripe') {
        paymentNote = 'Pagesa me kartë nuk është konfiguruar ende. Do t\'ju kontaktojmë për mënyra alternative.';
    }

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:5000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:450px;width:100%;padding:2.5rem;text-align:center;max-height:90vh;overflow-y:auto;">
            <div style="width:80px;height:80px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
                <i class="fas fa-check" style="font-size:2.5rem;color:#16a34a;"></i>
            </div>
            <h2 style="font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:#1a1a2e;margin-bottom:.5rem;">Porosia u Dërgua!</h2>
            <p style="color:#6b7280;margin-bottom:1rem;">Faleminderit për porosinë tuaj</p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem;margin-bottom:1rem;">
                <p style="font-size:.85rem;color:#6b7280;margin-bottom:.25rem;">Numri i porosisë</p>
                <p style="font-size:1.3rem;font-weight:700;color:#1a1a2e;">${orderNumber}</p>
                <p style="font-size:1.1rem;color:#9B1B1B;font-weight:600;margin-top:.5rem;">Totali: ${formatPrice(total)}</p>
            </div>
            ${extraInfo}
            <p style="font-size:.85rem;color:#6b7280;margin-bottom:1.5rem;">${paymentNote}</p>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="padding:.7rem 2rem;background:#9B1B1B;color:white;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-family:'Montserrat',sans-serif;">
                Vazhdo Blerjen
            </button>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function saveCart() { localStorage.setItem('trendCart', JSON.stringify(cart)); }
function formatPrice(p) { return new Intl.NumberFormat('sq-AL',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(p); }

function showNotification(msg) {
    const n = document.createElement('div');
    n.style.cssText = 'position:fixed;top:100px;right:20px;background:#9B1B1B;color:white;padding:1rem 1.5rem;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1);z-index:4000;animation:slideInRight .3s ease;font-family:Montserrat,sans-serif;';
    n.textContent = msg;
    if (!document.getElementById('notifStyle')) {
        const s = document.createElement('style'); s.id = 'notifStyle';
        s.textContent = '@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
        document.head.appendChild(s);
    }
    document.body.appendChild(n);
    setTimeout(() => { n.style.animation = 'slideInRight .3s ease reverse'; setTimeout(() => n.remove(), 300); }, 3000);
}

// === AUTH ===
async function checkClientAuth() {
    try {
        const res = await fetch('/api/client/check', { credentials: 'include' });
        const data = await res.json();
        if (data.loggedIn) {
            clientUser = { name: data.name, email: data.email };
            updateAuthUI();
        }
    } catch {}
}

function updateAuthUI() {
    const link = document.getElementById('authLink');
    const modal = document.getElementById('authModal');
    if (clientUser) {
        link.innerHTML = `<i class="fas fa-user"></i><span>${clientUser.name.split(' ')[0]}</span>`;
        link.classList.add('logged-in');
        document.getElementById('loginFormClient').style.display = 'none';
        document.getElementById('registerFormClient').style.display = 'none';
        document.getElementById('authLoggedIn').style.display = 'block';
        document.getElementById('authUserName').textContent = clientUser.name;
        document.getElementById('authUserEmail').textContent = clientUser.email;
        document.querySelector('.auth-tabs').style.display = 'none';
        document.getElementById('authTitle').textContent = 'Llogaria Ime';
        document.getElementById('authSubtitle').textContent = '';
    } else {
        link.innerHTML = '<i class="fas fa-user"></i><span>Kyçu / Regjistrohu</span>';
        link.classList.remove('logged-in');
        document.getElementById('authLoggedIn').style.display = 'none';
        document.querySelector('.auth-tabs').style.display = 'flex';
        document.getElementById('authTitle').textContent = 'Kyçu / Regjistrohu';
        document.getElementById('authSubtitle').textContent = 'Krijo një llogari të re për porosi më të shpejta.';
    }
}

function setupAuthListeners() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const isLogin = tab.dataset.tab === 'login';
            document.getElementById('loginFormClient').style.display = isLogin ? 'block' : 'none';
            document.getElementById('registerFormClient').style.display = isLogin ? 'none' : 'block';
        });
    });

    document.getElementById('loginFormClient').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Duke u kyçur...';
        btn.disabled = true;
        try {
            const res = await fetch('/api/client/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: document.getElementById('clientLoginEmail').value, password: document.getElementById('clientLoginPass').value })
            });
            const data = await res.json();
            if (data.success) { clientUser = { name: data.name, email: data.email }; updateAuthUI(); showNotification('Mirë se erdhe, ' + data.name.split(' ')[0] + '!'); }
            else alert(data.error || 'Gabim gjatë kyçjes');
        } catch (err) {
            alert('Gabim në lidhje me serverin. Provo përsëri.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('registerFormClient').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Duke u regjistruar...';
        btn.disabled = true;
        try {
            const body = {
                first_name: document.getElementById('regFirstName').value,
                last_name: document.getElementById('regLastName').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value,
                phone: document.getElementById('regPhone').value,
                country: document.getElementById('regCountry').value,
                city: document.getElementById('regCity').value,
                address: document.getElementById('regAddress').value
            };
            const res = await fetch('/api/client/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
            const data = await res.json();
            if (data.success) { clientUser = { name: data.name, email: data.email }; updateAuthUI(); showNotification('Regjistrimi u krye me sukses!'); }
            else alert(data.error || 'Gabim gjatë regjistrimit');
        } catch (err) {
            alert('Gabim në lidhje me serverin. Provo përsëri.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    document.getElementById('regCountry').addEventListener('change', populateCities);
    populateCities();
}

window.logoutClient = async function() {
    await fetch('/api/client/logout', { method: 'POST', credentials: 'include' });
    clientUser = null; updateAuthUI();
    showNotification('U çkyçët me sukses.');
};

const citiesByCountry = {
    XK: ['Prishtinë','Prizren','Pejë','Mitrovicë','Gjilan','Ferizaj','Gjakovë','Podujevë','Vushtrri','Suharekë','Rahovec','Drenas','Lipjan','Malishevë','Kamenicë','Viti','Deçan','Istog','Klinë','Skenderaj','Dragash','Fushë Kosovë','Kaçanik','Shtime','Obiliq','Hani i Elezit','Mamushë','Junik','Kllokot','Graçanicë','Ranillug','Partesh','Novobërdë','Zubin Potok','Zveçan','Leposaviç','Mitrovicë e Veriut'],
    AL: ['Tiranë','Durrës','Vlorë','Shkodër','Elbasan','Korçë','Fier','Berat','Lushnjë','Kavajë','Pogradec','Gjirokastër','Sarandë','Lezhë','Kukës','Peshkopi'],
    MK: ['Shkup','Tetovë','Gostivar','Kumanovë','Strugë','Ohër','Manastir','Kërçovë','Prilep','Veles'],
    ME: ['Podgoricë','Nikshiq','Tuz','Ulqin','Tivar','Budvë','Herceg Novi'],
    DE: ['Berlin','München','Hamburg','Frankfurt','Köln','Stuttgart','Düsseldorf'],
    CH: ['Zürich','Bern','Basel','Genf','Lausanne','Winterthur','Luzern'],
    AT: ['Wien','Graz','Linz','Salzburg','Innsbruck','Klagenfurt'],
};

function populateCities() {
    const country = document.getElementById('regCountry').value;
    const citySelect = document.getElementById('regCity');
    citySelect.innerHTML = '<option value="">Zgjidh qytetin</option>';
    (citiesByCountry[country] || []).forEach(c => {
        citySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

// === WISHLIST ===
function toggleWishlist(productId) {
    const idx = wishlist.findIndex(id => id === productId);
    if (idx >= 0) { wishlist.splice(idx, 1); showNotification('U hoq nga lista e dëshirave'); }
    else { wishlist.push(productId); showNotification('U shtua në listën e dëshirave!'); }
    localStorage.setItem('trendWishlist', JSON.stringify(wishlist));
    updateWishlistUI();
    renderProducts(products);
}

function updateWishlistUI() {
    document.getElementById('wishlistCount').textContent = wishlist.length;
    const container = document.getElementById('wishlistItems');
    if (wishlist.length === 0) {
        container.innerHTML = '<div class="empty-cart"><i class="fas fa-heart"></i><p>Lista e dëshirave është e zbrazët</p></div>';
        return;
    }
    container.innerHTML = wishlist.map(id => {
        const p = products.find(pr => pr.id === id);
        if (!p) return '';
        return `<div class="cart-item">
            <div class="cart-item-image"><i class="fas ${p.icon || 'fa-box'}"></i></div>
            <div class="cart-item-info">
                <div class="cart-item-name">${p.name}</div>
                <div class="cart-item-price">${formatPrice(p.price)}</div>
                <div class="cart-item-actions">
                    <button class="quantity-btn" onclick="addToCart(${p.id})" title="Shto në shportë"><i class="fas fa-cart-plus"></i></button>
                    <button class="remove-item" onclick="toggleWishlist(${p.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// === COMPARE ===
function toggleCompare(productId) {
    const idx = compareList.findIndex(id => id === productId);
    if (idx >= 0) { compareList.splice(idx, 1); showNotification('U hoq nga krahasimi'); }
    else {
        if (compareList.length >= 4) { showNotification('Maksimumi 4 produkte për krahasim!'); return; }
        compareList.push(productId); showNotification('U shtua për krahasim!');
    }
    localStorage.setItem('trendCompare', JSON.stringify(compareList));
    updateCompareUI();
    renderProducts(products);
}

function updateCompareUI() {
    document.getElementById('compareCount').textContent = compareList.length;
    const container = document.getElementById('compareContent');
    if (compareList.length === 0) {
        container.innerHTML = '<div class="empty-cart" style="padding:3rem;text-align:center;"><i class="fas fa-exchange-alt" style="font-size:3rem;color:#9ca3af;display:block;margin-bottom:1rem;"></i><p>Shtoni produkte për krahasim</p></div>';
        return;
    }
    const items = compareList.map(id => products.find(p => p.id === id)).filter(Boolean);
    const features = new Set();
    items.forEach(p => { (Array.isArray(p.features) ? p.features : []).forEach(f => features.add(f)); });

    container.innerHTML = `
        <table class="compare-table">
            <thead><tr><th></th>${items.map(p => `<th class="compare-product-header">
                ${p.image ? `<img src="${p.image}" alt="">` : `<i class="fas ${p.icon || 'fa-box'}" style="font-size:2rem;color:#9ca3af;"></i>`}
                <div style="font-size:0.8rem;font-weight:600;margin-top:0.3rem;">${p.name}</div>
                <button class="compare-remove" onclick="toggleCompare(${p.id})"><i class="fas fa-times"></i> Hiq</button>
            </th>`).join('')}</tr></thead>
            <tbody>
                <tr><td><strong>Çmimi</strong></td>${items.map(p => `<td><strong style="color:var(--primary-color)">${formatPrice(p.price)}</strong></td>`).join('')}</tr>
                <tr><td><strong>Lloji</strong></td>${items.map(p => `<td>${p.type}</td>`).join('')}</tr>
                <tr><td><strong>Stoku</strong></td>${items.map(p => `<td>${p.stock > 0 ? p.stock + ' copë' : '<span style="color:#ef4444">Jashtë</span>'}</td>`).join('')}</tr>
                <tr><td><strong>Kategoria</strong></td>${items.map(p => `<td>${getCategoryDisplayName(p)}</td>`).join('')}</tr>
                ${[...features].map(f => `<tr><td>${f}</td>${items.map(p => `<td>${(Array.isArray(p.features) ? p.features : []).includes(f) ? '<i class="fas fa-check" style="color:#10b981"></i>' : '<i class="fas fa-minus" style="color:#d1d5db"></i>'}</td>`).join('')}</tr>`).join('')}
                <tr><td></td>${items.map(p => `<td><button class="auth-submit" style="font-size:0.8rem;padding:0.5rem;" onclick="addToCart(${p.id})"><i class="fas fa-cart-plus"></i> Shto</button></td>`).join('')}</tr>
            </tbody>
        </table>`;
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.toggleWishlist = toggleWishlist;
window.toggleCompare = toggleCompare;
