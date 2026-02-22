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
            document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    alert(`Faleminderit për porosinë tuaj!\n\nTotali: ${formatPrice(cart.reduce((s,i)=>s+i.price*i.quantity,0))}\n\nDo t'ju kontaktojmë së shpejti.`);
    cart = []; saveCart(); updateCartUI(); cartSidebar.classList.remove('open');
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
        const res = await fetch('/api/customers/check');
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
        const res = await fetch('/api/customers/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById('clientLoginEmail').value, password: document.getElementById('clientLoginPass').value })
        });
        const data = await res.json();
        if (data.success) { clientUser = { name: data.name, email: data.email }; updateAuthUI(); showNotification('Mirë se erdhe, ' + data.name.split(' ')[0] + '!'); }
        else alert(data.error || 'Gabim');
    });

    document.getElementById('registerFormClient').addEventListener('submit', async (e) => {
        e.preventDefault();
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
        const res = await fetch('/api/customers/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { clientUser = { name: data.name, email: data.email }; updateAuthUI(); showNotification('Regjistrimi u krye me sukses!'); }
        else alert(data.error || 'Gabim');
    });

    document.getElementById('regCountry').addEventListener('change', populateCities);
    populateCities();
}

window.logoutClient = async function() {
    await fetch('/api/customers/logout', { method: 'POST' });
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
