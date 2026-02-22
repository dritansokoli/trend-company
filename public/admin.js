let categories = {};
let products = [];
let currentPage = 'dashboard';
let editingProductId = null;
let editingCatId = null;
let editingSubId = null;

async function api(url, opts = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    return res.json();
}

async function loadData() {
    categories = await api('/api/categories');
    products = await api('/api/products');
}

document.addEventListener('DOMContentLoaded', async () => {
    setupNav();
    const auth = await api('/api/auth/check');
    if (auth.loggedIn) showAdmin();
    else showLogin();
});

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminWrapper').style.display = 'none';
}

function showAdmin() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminWrapper').style.display = 'flex';
    setupSidebarLinks();
    loadPage('dashboard');
}

function setupSidebarLinks() {
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.replaceWith(link.cloneNode(true));
    });
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.sidebar-link[data-page]').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            loadPage(link.dataset.page);
        });
    });
}

function setupNav() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: document.getElementById('loginUsername').value, password: document.getElementById('loginPassword').value })
        });
        if (res.success) showAdmin();
        else alert(res.error || 'Gabim në hyrje');
    });

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await api('/api/auth/logout', { method: 'POST' });
        showLogin();
    });

    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.sidebar-link[data-page]').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            loadPage(link.dataset.page);
        });
    });
}

async function loadPage(page) {
    currentPage = page;
    const content = document.getElementById('adminContent');
    const title = document.getElementById('pageTitle');
    content.innerHTML = '<div style="text-align:center;padding:3rem;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#9ca3af;"></i></div>';
    await loadData();
    switch(page) {
        case 'dashboard': title.textContent = 'Dashboard'; await renderDashboard(content); break;
        case 'categories': title.textContent = 'Kategoritë'; renderCategories(content); break;
        case 'subcategories': title.textContent = 'Nën-Kategoritë'; renderSubcategories(content); break;
        case 'products': title.textContent = 'Produktet'; renderProductsPage(content); break;
        case 'stock': title.textContent = 'Menaxhimi i Stokut'; renderStockPage(content); break;
        case 'orders': title.textContent = 'Porositë'; await renderOrders(content); break;
        case 'customers': title.textContent = 'Klientët'; await renderCustomers(content); break;
        case 'settings': title.textContent = 'Cilësimet'; await renderSettings(content); break;
    }
}

// DASHBOARD
async function renderDashboard(el) {
    const stats = await api('/api/stats');
    el.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon red"><i class="fas fa-folder"></i></div><div class="stat-info"><h3>${stats.totalCats}</h3><p>Kategori</p></div></div>
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-folder-open"></i></div><div class="stat-info"><h3>${stats.totalSubs}</h3><p>Nën-Kategori</p></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-box"></i></div><div class="stat-info"><h3>${stats.totalProds}</h3><p>Produkte</p></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><i class="fas fa-euro-sign"></i></div><div class="stat-info"><h3>€${Number(stats.avgPrice).toFixed(2)}</h3><p>Çmimi mesatar</p></div></div>
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-users"></i></div><div class="stat-info"><h3>${stats.totalCustomers || 0}</h3><p>Klientë</p></div></div>
        </div>
        <div class="stats-grid">
            <div class="stat-card${stats.pendingOrders > 0 ? ' stock-warning' : ''}"><div class="stat-icon" style="background:#fef3c7;color:#f59e0b;"><i class="fas fa-shopping-bag"></i></div><div class="stat-info"><h3>${stats.totalOrders || 0}</h3><p>Porosi Gjithsej</p></div></div>
            <div class="stat-card${stats.pendingOrders > 0 ? ' stock-warning' : ''}"><div class="stat-icon" style="background:${stats.pendingOrders > 0 ? '#fef3c7' : '#e5e7eb'};color:${stats.pendingOrders > 0 ? '#f59e0b' : '#6b7280'};"><i class="fas fa-clock"></i></div><div class="stat-info"><h3>${stats.pendingOrders || 0}</h3><p>Porosi në Pritje</p></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-euro-sign"></i></div><div class="stat-info"><h3>€${Number(stats.totalRevenue || 0).toFixed(2)}</h3><p>Të Ardhura</p></div></div>
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-calendar-day"></i></div><div class="stat-info"><h3>${stats.todayOrders || 0}</h3><p>Porosi Sot</p></div></div>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-warehouse"></i></div><div class="stat-info"><h3>${stats.totalStock}</h3><p>Totali i Stokut</p></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><i class="fas fa-euro-sign"></i></div><div class="stat-info"><h3>€${Number(stats.stockValue).toFixed(2)}</h3><p>Vlera e Stokut</p></div></div>
            <div class="stat-card${stats.lowStock > 0 ? ' stock-warning' : ''}"><div class="stat-icon" style="background:${stats.lowStock > 0 ? '#FEF3C7' : '#E5E7EB'};color:${stats.lowStock > 0 ? '#D97706' : '#6B7280'}"><i class="fas fa-exclamation-triangle"></i></div><div class="stat-info"><h3>${stats.lowStock}</h3><p>Stok i Ulët</p></div></div>
            <div class="stat-card${stats.outOfStock > 0 ? ' stock-danger' : ''}"><div class="stat-icon" style="background:${stats.outOfStock > 0 ? '#FEE2E2' : '#E5E7EB'};color:${stats.outOfStock > 0 ? '#DC2626' : '#6B7280'}"><i class="fas fa-times-circle"></i></div><div class="stat-info"><h3>${stats.outOfStock}</h3><p>Jashtë Stokut</p></div></div>
        </div>
        <div class="stats-grid">
            ${Object.entries(categories).map(([k,c]) => {
                const count = products.filter(p => (p.main_category_key || p.mainCategory) === k).length;
                return `<div class="stat-card"><div class="stat-icon red"><i class="fas ${c.icon}"></i></div><div class="stat-info"><h3>${count}</h3><p>${c.name}</p></div></div>`;
            }).join('')}
        </div>`;
}

// CATEGORIES
function renderCategories(el) {
    el.innerHTML = `
        <div class="admin-table-wrapper">
            <div class="table-header"><h2>Kategoritë Kryesore</h2><button class="btn btn-primary" onclick="openCategoryModal()"><i class="fas fa-plus"></i> Shto Kategori</button></div>
            <table class="admin-table"><thead><tr><th>Ikona</th><th>Emri</th><th>Çelësi</th><th>Nën-Kategori</th><th>Produkte</th><th>Veprime</th></tr></thead><tbody>
                ${Object.entries(categories).map(([key, cat]) => {
                    const subCount = Object.keys(cat.subcategories || {}).length;
                    const prodCount = products.filter(p => (p.main_category_key || p.mainCategory) === key).length;
                    return `<tr><td><div class="table-img"><i class="fas ${cat.icon}"></i></div></td><td><strong>${cat.name}</strong></td><td><code>${key}</code></td><td>${subCount}</td><td>${prodCount}</td><td class="actions"><button class="btn btn-outline btn-sm" onclick="openCategoryModal('${key}',${cat.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteCategory(${cat.id},'${cat.name}')"><i class="fas fa-trash"></i></button></td></tr>`;
                }).join('')}
            </tbody></table>
            ${Object.keys(categories).length === 0 ? '<div class="empty-state"><i class="fas fa-folder"></i><p>Nuk ka kategori.</p></div>' : ''}
        </div>
        <div class="admin-modal" id="categoryModal"><div class="modal-card"><div class="modal-card-header"><h2 id="catModalTitle">Shto Kategori</h2><button class="modal-close" onclick="closeCategoryModal()">&times;</button></div><div class="modal-card-body">
            <div class="form-group"><label>Emri</label><input type="text" id="catName" placeholder="p.sh. Dyer"></div>
            <div class="form-row"><div class="form-group"><label>Çelësi (ID)</label><input type="text" id="catKey" placeholder="p.sh. dyer"></div><div class="form-group"><label>Ikona</label><input type="text" id="catIcon" value="fa-box"></div></div>
        </div><div class="modal-card-footer"><button class="btn btn-outline" onclick="closeCategoryModal()">Anulo</button><button class="btn btn-primary" onclick="saveCategory()"><i class="fas fa-save"></i> Ruaj</button></div></div></div>`;
}

window.openCategoryModal = function(key, id) {
    editingCatId = id || null;
    document.getElementById('catModalTitle').textContent = id ? 'Ndrysho Kategorinë' : 'Shto Kategori';
    if (key && categories[key]) {
        document.getElementById('catName').value = categories[key].name;
        document.getElementById('catKey').value = key;
        document.getElementById('catIcon').value = categories[key].icon;
        document.getElementById('catKey').disabled = true;
    } else {
        document.getElementById('catName').value = ''; document.getElementById('catKey').value = ''; document.getElementById('catIcon').value = 'fa-box';
        document.getElementById('catKey').disabled = false;
    }
    document.getElementById('categoryModal').classList.add('show');
};
window.closeCategoryModal = () => document.getElementById('categoryModal').classList.remove('show');

window.saveCategory = async function() {
    const name = document.getElementById('catName').value.trim();
    const key = document.getElementById('catKey').value.trim().toLowerCase().replace(/\s+/g,'-');
    const icon = document.getElementById('catIcon').value.trim();
    if (!name || !key) { alert('Plotëso fushat!'); return; }
    if (editingCatId) await api(`/api/categories/${editingCatId}`, { method: 'PUT', body: JSON.stringify({ name, icon }) });
    else await api('/api/categories', { method: 'POST', body: JSON.stringify({ key, name, icon }) });
    closeCategoryModal(); loadPage('categories');
};

window.deleteCategory = async function(id, name) {
    if (!confirm(`Fshi kategorinë "${name}"?`)) return;
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    loadPage('categories');
};

// SUBCATEGORIES
function renderSubcategories(el) {
    let rows = '';
    Object.entries(categories).forEach(([mainKey, cat]) => {
        Object.entries(cat.subcategories || {}).forEach(([subKey, sub]) => {
            const prodCount = products.filter(p => (p.sub_category_key || p.category) === subKey).length;
            rows += `<tr><td><div class="table-img"><i class="fas ${sub.icon}"></i></div></td><td><strong>${sub.name}</strong></td><td><span class="badge badge-premium">${cat.name}</span></td><td><code>${subKey}</code></td><td>${prodCount}</td><td class="actions"><button class="btn btn-outline btn-sm" onclick="openSubModal('${mainKey}','${subKey}',${sub.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteSubcategory(${sub.id},'${sub.name}')"><i class="fas fa-trash"></i></button></td></tr>`;
        });
    });
    const catOpts = Object.entries(categories).map(([k,c]) => `<option value="${k}" data-id="${c.id}">${c.name}</option>`).join('');
    el.innerHTML = `
        <div class="admin-table-wrapper">
            <div class="table-header"><h2>Nën-Kategoritë</h2><button class="btn btn-primary" onclick="openSubModal()"><i class="fas fa-plus"></i> Shto</button></div>
            <table class="admin-table"><thead><tr><th>Ikona</th><th>Emri</th><th>Kategoria</th><th>Çelësi</th><th>Produkte</th><th>Veprime</th></tr></thead><tbody>${rows}</tbody></table>
            ${rows === '' ? '<div class="empty-state"><i class="fas fa-folder-open"></i><p>Nuk ka nën-kategori.</p></div>' : ''}
        </div>
        <div class="admin-modal" id="subModal"><div class="modal-card"><div class="modal-card-header"><h2 id="subModalTitle">Shto Nën-Kategori</h2><button class="modal-close" onclick="closeSubModal()">&times;</button></div><div class="modal-card-body">
            <div class="form-group"><label>Kategoria</label><select id="subParent">${catOpts}</select></div>
            <div class="form-group"><label>Emri</label><input type="text" id="subName"></div>
            <div class="form-row"><div class="form-group"><label>Çelësi</label><input type="text" id="subKey"></div><div class="form-group"><label>Ikona</label><input type="text" id="subIcon" value="fa-box"></div></div>
        </div><div class="modal-card-footer"><button class="btn btn-outline" onclick="closeSubModal()">Anulo</button><button class="btn btn-primary" onclick="saveSubcategory()"><i class="fas fa-save"></i> Ruaj</button></div></div></div>`;
}

window.openSubModal = function(mainKey, subKey, id) {
    editingSubId = id || null;
    document.getElementById('subModalTitle').textContent = id ? 'Ndrysho' : 'Shto Nën-Kategori';
    if (mainKey && subKey && categories[mainKey]?.subcategories?.[subKey]) {
        const sub = categories[mainKey].subcategories[subKey];
        document.getElementById('subParent').value = mainKey;
        document.getElementById('subName').value = sub.name;
        document.getElementById('subKey').value = subKey; document.getElementById('subKey').disabled = true;
        document.getElementById('subIcon').value = sub.icon; document.getElementById('subParent').disabled = true;
    } else {
        document.getElementById('subName').value = ''; document.getElementById('subKey').value = ''; document.getElementById('subIcon').value = 'fa-box';
        document.getElementById('subKey').disabled = false; document.getElementById('subParent').disabled = false;
    }
    document.getElementById('subModal').classList.add('show');
};
window.closeSubModal = () => document.getElementById('subModal').classList.remove('show');

window.saveSubcategory = async function() {
    const parentSelect = document.getElementById('subParent');
    const parentId = parentSelect.options[parentSelect.selectedIndex].dataset.id;
    const name = document.getElementById('subName').value.trim();
    const key = document.getElementById('subKey').value.trim().toLowerCase().replace(/\s+/g,'-');
    const icon = document.getElementById('subIcon').value.trim();
    if (!name || !key) { alert('Plotëso fushat!'); return; }
    if (editingSubId) await api(`/api/categories/${editingSubId}`, { method: 'PUT', body: JSON.stringify({ name, icon }) });
    else await api('/api/categories', { method: 'POST', body: JSON.stringify({ key, name, icon, parentId: parseInt(parentId) }) });
    closeSubModal(); loadPage('subcategories');
};

window.deleteSubcategory = async function(id, name) {
    if (!confirm(`Fshi "${name}"?`)) return;
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    loadPage('subcategories');
};

// PRODUCTS
function renderProductsPage(el) {
    const catOpts = Object.entries(categories).map(([k,c]) => `<option value="${k}">${c.name}</option>`).join('');
    el.innerHTML = `
        <div class="admin-table-wrapper">
            <div class="table-header"><h2>Produktet (${products.length})</h2><button class="btn btn-primary" onclick="openProductModal()"><i class="fas fa-plus"></i> Shto Produkt</button></div>
            <table class="admin-table"><thead><tr><th>Foto</th><th>Emri</th><th>Kategoria</th><th>Çmimi</th><th>Stoku</th><th>Lloji</th><th>Veprime</th></tr></thead><tbody>
                ${products.map(p => {
                    const mainKey = p.main_category_key || p.mainCategory;
                    const subKey = p.sub_category_key || p.category;
                    const catName = categories[mainKey]?.name || mainKey;
                    const subName = categories[mainKey]?.subcategories?.[subKey]?.name || subKey;
                    const img = p.image ? `<img src="${p.image}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;">` : `<div class="table-img"><i class="fas ${p.icon||'fa-box'}"></i></div>`;
                    const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= (p.stock_min || 5) ? 'stock-low' : 'stock-ok';
                    const stockLabel = p.stock === 0 ? 'Jashtë' : p.stock <= (p.stock_min || 5) ? 'I ulët' : 'Në gjendje';
                    return `<tr><td>${img}</td><td><strong>${p.name}</strong><br><small style="color:#6b7280">${subName}</small></td><td><span class="badge badge-premium">${catName}</span></td><td><strong>€${Number(p.price).toFixed(2)}</strong></td><td><span class="badge badge-stock-${stockClass}">${p.stock} <small>(${stockLabel})</small></span></td><td><span class="badge badge-${p.type}">${p.type}</span></td><td class="actions"><button class="btn btn-outline btn-sm" onclick="openProductModal(${p.id})"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id},'${p.name.replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button></td></tr>`;
                }).join('')}
            </tbody></table>
            ${products.length === 0 ? '<div class="empty-state"><i class="fas fa-box"></i><p>Nuk ka produkte.</p></div>' : ''}
        </div>
        <div class="admin-modal" id="productModal"><div class="modal-card"><div class="modal-card-header"><h2 id="prodModalTitle">Shto Produkt</h2><button class="modal-close" onclick="closeProductModal()">&times;</button></div><div class="modal-card-body">
            <div class="form-group"><label>Emri</label><input type="text" id="prodName"></div>
            <div class="form-row"><div class="form-group"><label>Kategoria</label><select id="prodMainCat" onchange="updateSubcatOptions()">${catOpts}</select></div><div class="form-group"><label>Nën-Kategoria</label><select id="prodSubCat"></select></div></div>
            <div class="form-row"><div class="form-group"><label>Çmimi (EUR)</label><input type="number" id="prodPrice" step="0.01"></div><div class="form-group"><label>Lloji</label><select id="prodType"><option value="standard">Standard</option><option value="premium">Premium</option></select></div></div>
            <div class="form-row"><div class="form-group"><label>Stoku</label><input type="number" id="prodStock" min="0" value="0"></div><div class="form-group"><label>Stoku Minimal (paralajmërim)</label><input type="number" id="prodStockMin" min="0" value="5"></div></div>
            <div class="form-group"><label>Përshkrimi</label><textarea id="prodDesc" rows="3"></textarea></div>
            <div class="form-group"><label>Ikona</label><input type="text" id="prodIcon" value="fa-box"></div>
            <div class="form-group"><label>Veçoritë (njëra për rresht)</label><textarea id="prodFeatures" rows="4"></textarea></div>
            <div class="form-group"><label>Foto</label>
                <div class="image-upload-area" onclick="document.getElementById('prodImageInput').click()"><i class="fas fa-cloud-upload-alt"></i><p>Kliko për të ngarkuar foto</p><input type="file" id="prodImageInput" accept="image/*" style="display:none" onchange="previewProductImage(this)"></div>
                <img id="prodImagePreview" class="image-preview" style="display:none">
            </div>
        </div><div class="modal-card-footer"><button class="btn btn-outline" onclick="closeProductModal()">Anulo</button><button class="btn btn-primary" onclick="saveProduct()"><i class="fas fa-save"></i> Ruaj</button></div></div></div>`;
    updateSubcatOptions();
}

window.updateSubcatOptions = function() {
    const mc = document.getElementById('prodMainCat')?.value;
    const sel = document.getElementById('prodSubCat');
    if (!sel || !mc || !categories[mc]) return;
    sel.innerHTML = Object.entries(categories[mc].subcategories || {}).map(([k,s]) => `<option value="${k}">${s.name}</option>`).join('');
};

window.openProductModal = function(id) {
    editingProductId = id || null;
    document.getElementById('prodModalTitle').textContent = id ? 'Ndrysho Produktin' : 'Shto Produkt';
    document.getElementById('prodImagePreview').style.display = 'none';
    if (id) {
        const p = products.find(pr => pr.id === id); if (!p) return;
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodMainCat').value = p.main_category_key || p.mainCategory;
        updateSubcatOptions();
        setTimeout(() => { document.getElementById('prodSubCat').value = p.sub_category_key || p.category; }, 50);
        document.getElementById('prodPrice').value = p.price;
        document.getElementById('prodType').value = p.type;
        document.getElementById('prodStock').value = p.stock ?? 0;
        document.getElementById('prodStockMin').value = p.stock_min ?? 5;
        document.getElementById('prodDesc').value = p.description || '';
        document.getElementById('prodIcon').value = p.icon || 'fa-box';
        document.getElementById('prodFeatures').value = (Array.isArray(p.features) ? p.features : []).join('\n');
        if (p.image) { document.getElementById('prodImagePreview').src = p.image; document.getElementById('prodImagePreview').style.display = 'block'; }
    } else {
        ['prodName','prodPrice','prodDesc','prodFeatures'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('prodType').value = 'standard'; document.getElementById('prodIcon').value = 'fa-box';
        document.getElementById('prodStock').value = '0'; document.getElementById('prodStockMin').value = '5';
        updateSubcatOptions();
    }
    document.getElementById('productModal').classList.add('show');
};
window.closeProductModal = () => document.getElementById('productModal').classList.remove('show');

window.previewProductImage = function(input) {
    if (input.files?.[0]) {
        const r = new FileReader();
        r.onload = (e) => { document.getElementById('prodImagePreview').src = e.target.result; document.getElementById('prodImagePreview').style.display = 'block'; };
        r.readAsDataURL(input.files[0]);
    }
};

window.saveProduct = async function() {
    const name = document.getElementById('prodName').value.trim();
    const mc = document.getElementById('prodMainCat').value;
    const sc = document.getElementById('prodSubCat').value;
    const price = document.getElementById('prodPrice').value;
    const type = document.getElementById('prodType').value;
    const desc = document.getElementById('prodDesc').value.trim();
    const icon = document.getElementById('prodIcon').value.trim();
    const features = document.getElementById('prodFeatures').value.trim().split('\n').filter(f => f.trim());
    if (!name || !mc || !sc || !price) { alert('Plotëso fushat!'); return; }

    const stock = document.getElementById('prodStock').value;
    const stockMin = document.getElementById('prodStockMin').value;

    const formData = new FormData();
    formData.append('name', name);
    formData.append('main_category_key', mc);
    formData.append('sub_category_key', sc);
    formData.append('price', price);
    formData.append('type', type);
    formData.append('description', desc);
    formData.append('icon', icon);
    formData.append('features', JSON.stringify(features));
    formData.append('stock', stock);
    formData.append('stock_min', stockMin);
    const fileInput = document.getElementById('prodImageInput');
    if (fileInput.files?.[0]) formData.append('image', fileInput.files[0]);

    const url = editingProductId ? `/api/products/${editingProductId}` : '/api/products';
    const method = editingProductId ? 'PUT' : 'POST';
    await fetch(url, { method, body: formData });
    closeProductModal(); loadPage('products');
};

window.deleteProduct = async function(id, name) {
    if (!confirm(`Fshi "${name}"?`)) return;
    await api(`/api/products/${id}`, { method: 'DELETE' });
    loadPage('products');
};

// STOCK MANAGEMENT
function renderStockPage(el) {
    const outOfStock = products.filter(p => p.stock === 0);
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= (p.stock_min || 5));
    const inStock = products.filter(p => p.stock > (p.stock_min || 5));

    const stockRow = (p) => {
        const mainKey = p.main_category_key || p.mainCategory;
        const subKey = p.sub_category_key || p.category;
        const catName = categories[mainKey]?.name || mainKey;
        const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= (p.stock_min || 5) ? 'stock-low' : 'stock-ok';
        return `<tr class="stock-row-${stockClass}">
            <td><strong>${p.name}</strong></td>
            <td>${catName}</td>
            <td class="stock-cell">
                <div class="stock-controls">
                    <button class="stock-btn stock-minus" onclick="adjustStock(${p.id}, -1)"><i class="fas fa-minus"></i></button>
                    <input type="number" class="stock-input" value="${p.stock}" min="0" onchange="setStock(${p.id}, this.value)" id="stockInput${p.id}">
                    <button class="stock-btn stock-plus" onclick="adjustStock(${p.id}, 1)"><i class="fas fa-plus"></i></button>
                </div>
            </td>
            <td>${p.stock_min || 5}</td>
            <td><span class="badge badge-stock-${stockClass}">${p.stock === 0 ? 'Jashtë Stokut' : p.stock <= (p.stock_min || 5) ? 'Stok i Ulët' : 'Në Gjendje'}</span></td>
            <td class="actions">
                <button class="btn btn-outline btn-sm" onclick="quickRestock(${p.id})" title="Rifresko stokun"><i class="fas fa-boxes-stacked"></i></button>
            </td>
        </tr>`;
    };

    el.innerHTML = `
        <div class="stats-grid" style="margin-bottom:1.5rem;">
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check-circle"></i></div><div class="stat-info"><h3>${inStock.length}</h3><p>Në Gjendje</p></div></div>
            <div class="stat-card${lowStock.length > 0 ? ' stock-warning' : ''}"><div class="stat-icon" style="background:#FEF3C7;color:#D97706"><i class="fas fa-exclamation-triangle"></i></div><div class="stat-info"><h3>${lowStock.length}</h3><p>Stok i Ulët</p></div></div>
            <div class="stat-card${outOfStock.length > 0 ? ' stock-danger' : ''}"><div class="stat-icon" style="background:#FEE2E2;color:#DC2626"><i class="fas fa-times-circle"></i></div><div class="stat-info"><h3>${outOfStock.length}</h3><p>Jashtë Stokut</p></div></div>
        </div>
        ${outOfStock.length > 0 ? `
        <div class="admin-table-wrapper" style="margin-bottom:1.5rem;border-left:4px solid #DC2626;">
            <div class="table-header"><h2 style="color:#DC2626"><i class="fas fa-times-circle"></i> Jashtë Stokut (${outOfStock.length})</h2></div>
            <table class="admin-table"><thead><tr><th>Produkti</th><th>Kategoria</th><th>Stoku</th><th>Min</th><th>Gjendja</th><th>Veprime</th></tr></thead>
            <tbody>${outOfStock.map(stockRow).join('')}</tbody></table>
        </div>` : ''}
        ${lowStock.length > 0 ? `
        <div class="admin-table-wrapper" style="margin-bottom:1.5rem;border-left:4px solid #D97706;">
            <div class="table-header"><h2 style="color:#D97706"><i class="fas fa-exclamation-triangle"></i> Stok i Ulët (${lowStock.length})</h2></div>
            <table class="admin-table"><thead><tr><th>Produkti</th><th>Kategoria</th><th>Stoku</th><th>Min</th><th>Gjendja</th><th>Veprime</th></tr></thead>
            <tbody>${lowStock.map(stockRow).join('')}</tbody></table>
        </div>` : ''}
        <div class="admin-table-wrapper">
            <div class="table-header"><h2><i class="fas fa-warehouse"></i> Të Gjitha Produktet (${products.length})</h2></div>
            <table class="admin-table"><thead><tr><th>Produkti</th><th>Kategoria</th><th>Stoku</th><th>Min</th><th>Gjendja</th><th>Veprime</th></tr></thead>
            <tbody>${products.map(stockRow).join('')}</tbody></table>
        </div>`;
}

window.adjustStock = async function(id, change) {
    const res = await api(`/api/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ change }) });
    if (res.success) {
        const input = document.getElementById('stockInput' + id);
        if (input) input.value = res.stock;
        loadPage('stock');
    }
};

window.setStock = async function(id, value) {
    await api(`/api/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ absolute: parseInt(value) }) });
    loadPage('stock');
};

window.quickRestock = async function(id) {
    const qty = prompt('Sa njësi dëshironi të shtoni në stok?', '10');
    if (qty === null) return;
    const num = parseInt(qty);
    if (isNaN(num) || num <= 0) { alert('Vendos një numër valid!'); return; }
    await api(`/api/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ change: num }) });
    loadPage('stock');
};

async function renderOrders(el) {
    let orders = [];
    try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        if (Array.isArray(data)) orders = data;
    } catch (e) { console.log('Orders API error:', e); }

    const statusLabels = { pending:'Në Pritje', confirmed:'Konfirmuar', processing:'Në Përpunim', shipped:'Dërguar', delivered:'Dorëzuar', cancelled:'Anuluar' };
    const statusColors = { pending:'#f59e0b', confirmed:'#3b82f6', processing:'#8b5cf6', shipped:'#06b6d4', delivered:'#16a34a', cancelled:'#ef4444' };
    const pmLabels = { cod:'Para në Dorë', bank:'Transfertë', card:'Kartë' };
    const pmIcons = { cod:'fa-money-bill-wave', bank:'fa-university', card:'fa-credit-card' };
    const pmColors = { cod:'#16a34a', bank:'#3b82f6', card:'#f59e0b' };
    const payLabels = { unpaid:'E Papaguar', awaiting:'Në Pritje', paid:'E Paguar', refunded:'Rimbursuar' };
    const payColors = { unpaid:'#ef4444', awaiting:'#f59e0b', paid:'#16a34a', refunded:'#8b5cf6' };

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => ['confirmed','processing','shipped'].includes(o.status)).length,
        unpaid: orders.filter(o => o.payment_status === 'unpaid' && o.status !== 'cancelled').length,
        revenue: orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
    };

    el.innerHTML = `
        <div class="stats-grid" style="margin-bottom:1.5rem;">
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-shopping-bag"></i></div><div class="stat-info"><h3>${stats.total}</h3><p>Porosi Gjithsej</p></div></div>
            <div class="stat-card" style="${stats.pending > 0 ? 'border-left:3px solid #f59e0b;' : ''}"><div class="stat-icon" style="background:#fef3c7;color:#f59e0b;"><i class="fas fa-clock"></i></div><div class="stat-info"><h3>${stats.pending}</h3><p>Në Pritje</p></div></div>
            <div class="stat-card" style="${stats.unpaid > 0 ? 'border-left:3px solid #ef4444;' : ''}"><div class="stat-icon" style="background:#fee2e2;color:#ef4444;"><i class="fas fa-exclamation-circle"></i></div><div class="stat-info"><h3>${stats.unpaid}</h3><p>Të Papaguara</p></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-euro-sign"></i></div><div class="stat-info"><h3>${stats.revenue.toFixed(2)} €</h3><p>Të Ardhura</p></div></div>
        </div>

        <div class="admin-table-wrapper">
            <div class="table-header">
                <h2><i class="fas fa-shopping-bag"></i> Porositë</h2>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                    <button class="btn btn-sm ${!window._orderFilter || window._orderFilter === 'all' ? 'btn-primary' : 'btn-outline'}" onclick="filterOrders('all')">Të Gjitha</button>
                    <button class="btn btn-sm ${window._orderFilter === 'pending' ? 'btn-primary' : 'btn-outline'}" onclick="filterOrders('pending')">Në Pritje</button>
                    <button class="btn btn-sm ${window._orderFilter === 'confirmed' ? 'btn-primary' : 'btn-outline'}" onclick="filterOrders('confirmed')">Konfirmuar</button>
                    <button class="btn btn-sm ${window._orderFilter === 'shipped' ? 'btn-primary' : 'btn-outline'}" onclick="filterOrders('shipped')">Dërguar</button>
                    <button class="btn btn-sm ${window._orderFilter === 'delivered' ? 'btn-primary' : 'btn-outline'}" onclick="filterOrders('delivered')">Dorëzuar</button>
                    <button class="btn btn-sm ${window._orderFilter === 'cancelled' ? 'btn-primary' : 'btn-outline'}" onclick="filterOrders('cancelled')">Anuluar</button>
                </div>
            </div>
            <table class="admin-table"><thead><tr>
                <th>#</th><th>Nr. Porosisë</th><th>Klienti</th><th>Totali</th><th>Pagesa</th><th>Statusi</th><th>Data</th><th>Veprime</th>
            </tr></thead><tbody>
                ${orders.map((o, i) => {
                    const pm = o.payment_method || 'cod';
                    const ps = o.payment_status || 'unpaid';
                    return `<tr>
                    <td>${i + 1}</td>
                    <td><strong style="font-family:monospace;">${o.order_number}</strong></td>
                    <td>
                        <strong>${o.customer_name}</strong><br>
                        <small style="color:#6b7280;">${o.customer_phone}</small>
                    </td>
                    <td><strong style="color:#9B1B1B;">${o.total.toFixed(2)} €</strong></td>
                    <td>
                        <div style="display:flex;flex-direction:column;gap:.3rem;">
                            <span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;color:${pmColors[pm]};font-weight:600;">
                                <i class="fas ${pmIcons[pm]}"></i> ${pmLabels[pm] || pm}
                            </span>
                            <select onchange="updatePaymentStatus(${o.id}, this.value)" style="padding:.2rem .4rem;border-radius:5px;border:1px solid ${payColors[ps]};color:${payColors[ps]};font-weight:600;font-size:.75rem;background:white;cursor:pointer;">
                                ${Object.keys(payLabels).map(s => `<option value="${s}" ${s === ps ? 'selected' : ''}>${payLabels[s]}</option>`).join('')}
                            </select>
                        </div>
                    </td>
                    <td>
                        <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding:.3rem .5rem;border-radius:6px;border:1px solid ${statusColors[o.status]};color:${statusColors[o.status]};font-weight:600;font-size:.8rem;background:white;cursor:pointer;">
                            ${Object.keys(statusLabels).map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
                        </select>
                    </td>
                    <td><small>${new Date(o.created_at).toLocaleDateString('sq-AL')} ${new Date(o.created_at).toLocaleTimeString('sq-AL', {hour:'2-digit',minute:'2-digit'})}</small></td>
                    <td class="actions">
                        <button class="btn btn-outline btn-sm" onclick="viewOrder(${o.id})" title="Shiko"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="deleteOrder(${o.id},'${o.order_number}')" title="Fshi"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;}).join('')}
            </tbody></table>
            ${orders.length === 0 ? '<div class="empty-state"><i class="fas fa-shopping-bag"></i><p>Nuk ka porosi ende.</p></div>' : ''}
        </div>`;
}

window.filterOrders = function(status) {
    window._orderFilter = status;
    loadPage('orders');
};

window.updateOrderStatus = async function(id, status) {
    await api(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    showNotification('Statusi u përditësua!');
    loadPage('orders');
};

window.updatePaymentStatus = async function(id, payment_status) {
    await api(`/api/orders/${id}/payment`, { method: 'PATCH', body: JSON.stringify({ payment_status }) });
    showNotification('Statusi i pagesës u përditësua!');
    loadPage('orders');
};

window.viewOrder = async function(id) {
    const o = await api('/api/orders/' + id);
    if (!o.id) return;
    const statusLabels = { pending:'Në Pritje', confirmed:'Konfirmuar', processing:'Në Përpunim', shipped:'Dërguar', delivered:'Dorëzuar', cancelled:'Anuluar' };
    const countryNames = { XK:'Kosovë', AL:'Shqipëri', MK:'Maqedoni', ME:'Mal i Zi', DE:'Gjermani', CH:'Zvicër', AT:'Austri' };
    const pmLabels = { cod:'Para në Dorë', bank:'Transfertë Bankare', card:'Kartë Krediti/Debiti' };
    const pmIcons = { cod:'fa-money-bill-wave', bank:'fa-university', card:'fa-credit-card' };
    const payLabels = { unpaid:'E Papaguar', awaiting:'Në Pritje', paid:'E Paguar', refunded:'Rimbursuar' };
    const payColors = { unpaid:'#ef4444', awaiting:'#f59e0b', paid:'#16a34a', refunded:'#8b5cf6' };
    const pm = o.payment_method || 'cod';
    const ps = o.payment_status || 'unpaid';

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:5000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;padding:2rem;position:relative;">
            <button onclick="this.closest('div[style*=fixed]').remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
            <h2 style="margin-bottom:1rem;font-size:1.3rem;"><i class="fas fa-receipt" style="color:#9B1B1B;"></i> Porosia ${o.order_number}</h2>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
                <div style="background:#f8f9fa;padding:1rem;border-radius:10px;">
                    <h4 style="font-size:.85rem;color:#6b7280;margin-bottom:.5rem;">Klienti</h4>
                    <p><strong>${o.customer_name}</strong></p>
                    <p style="font-size:.85rem;">${o.customer_email}</p>
                    <p style="font-size:.85rem;">${o.customer_phone}</p>
                    <p style="font-size:.85rem;">${o.customer_address || '-'}</p>
                    <p style="font-size:.85rem;">${o.customer_city || '-'}, ${countryNames[o.customer_country] || o.customer_country || '-'}</p>
                </div>
                <div style="background:#f8f9fa;padding:1rem;border-radius:10px;">
                    <h4 style="font-size:.85rem;color:#6b7280;margin-bottom:.5rem;">Detaje</h4>
                    <p><strong>Statusi:</strong> ${statusLabels[o.status]}</p>
                    <p><strong>Pagesa:</strong> <i class="fas ${pmIcons[pm]}"></i> ${pmLabels[pm] || pm}</p>
                    <p><strong>Statusi i pagesës:</strong> <span style="color:${payColors[ps]};font-weight:600;">${payLabels[ps] || ps}</span></p>
                    <p><strong>Nëntotali:</strong> ${o.subtotal.toFixed(2)} €</p>
                    <p><strong>Dërgesa:</strong> ${o.shipping === 0 ? 'FALAS' : o.shipping.toFixed(2) + ' €'}</p>
                    <p style="font-size:1.1rem;font-weight:700;color:#9B1B1B;margin-top:.5rem;">Totali: ${o.total.toFixed(2)} €</p>
                </div>
            </div>

            <h4 style="margin-bottom:.75rem;">Produktet</h4>
            <table style="width:100%;border-collapse:collapse;font-size:.85rem;">
                <thead><tr style="background:#f8f9fa;"><th style="padding:.5rem;text-align:left;">Produkti</th><th style="padding:.5rem;text-align:center;">Sasia</th><th style="padding:.5rem;text-align:right;">Çmimi</th><th style="padding:.5rem;text-align:right;">Totali</th></tr></thead>
                <tbody>${o.items.map(it => `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:.5rem;">${it.name}</td>
                    <td style="padding:.5rem;text-align:center;">${it.quantity}</td>
                    <td style="padding:.5rem;text-align:right;">${it.price.toFixed(2)} €</td>
                    <td style="padding:.5rem;text-align:right;font-weight:600;">${(it.price * it.quantity).toFixed(2)} €</td>
                </tr>`).join('')}</tbody>
            </table>

            ${o.notes ? `<div style="margin-top:1rem;padding:.75rem;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;"><strong style="font-size:.85rem;">Shënime:</strong><p style="font-size:.85rem;margin-top:.25rem;">${o.notes}</p></div>` : ''}
            <p style="font-size:.8rem;color:#9ca3af;margin-top:1rem;">Krijuar: ${new Date(o.created_at).toLocaleString('sq-AL')}</p>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

window.deleteOrder = async function(id, num) {
    if (!confirm(`Jeni i sigurt që doni të fshini porosinë "${num}"?`)) return;
    await api('/api/orders/' + id, { method: 'DELETE' });
    loadPage('orders');
};

function showNotification(msg) {
    const n = document.createElement('div');
    n.style.cssText = 'position:fixed;top:80px;right:20px;background:#16a34a;color:white;padding:.75rem 1.25rem;border-radius:8px;z-index:9999;font-size:.9rem;box-shadow:0 4px 6px rgba(0,0,0,.1);';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

// CUSTOMERS
async function renderCustomers(el) {
    let customers = [];
    try {
        const res = await fetch('/api/customers');
        const data = await res.json();
        if (Array.isArray(data)) customers = data;
        else console.log('Customers API response:', data);
    } catch (e) { console.log('Customers API error:', e); }
    const countryNames = { XK:'Kosovë', AL:'Shqipëri', MK:'Maqedoni', ME:'Mal i Zi', DE:'Gjermani', CH:'Zvicër', AT:'Austri', OTHER:'Tjetër' };

    el.innerHTML = `
        <div class="stats-grid" style="margin-bottom:1.5rem;">
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-users"></i></div><div class="stat-info"><h3>${customers.length}</h3><p>Klientë Gjithsej</p></div></div>
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-user-plus"></i></div><div class="stat-info"><h3>${customers.filter(c => { const d = new Date(c.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length}</h3><p>Klientë të Rinj (këtë muaj)</p></div></div>
        </div>
        <div class="admin-table-wrapper">
            <div class="table-header"><h2><i class="fas fa-users"></i> Klientët e Regjistruar</h2></div>
            <table class="admin-table"><thead><tr><th>#</th><th>Emri</th><th>Email</th><th>Telefoni</th><th>Lokacioni</th><th>Adresa</th><th>Regjistruar</th><th>Veprime</th></tr></thead><tbody>
                ${customers.map((c, i) => `<tr>
                    <td>${i + 1}</td>
                    <td><strong>${c.first_name} ${c.last_name}</strong></td>
                    <td><a href="mailto:${c.email}" style="color:var(--primary)">${c.email}</a></td>
                    <td>${c.phone ? `<a href="tel:${c.phone}" style="color:inherit">${c.phone}</a>` : '<span style="color:#9ca3af">-</span>'}</td>
                    <td>${c.city ? c.city + ', ' : ''}${countryNames[c.country] || c.country || '-'}</td>
                    <td>${c.address || '<span style="color:#9ca3af">-</span>'}</td>
                    <td><small>${new Date(c.created_at).toLocaleDateString('sq-AL')}</small></td>
                    <td class="actions">
                        <button class="btn btn-outline btn-sm" onclick="viewCustomer(${c.id})" title="Shiko detajet"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id},'${c.first_name} ${c.last_name}')" title="Fshi"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('')}
            </tbody></table>
            ${customers.length === 0 ? '<div class="empty-state"><i class="fas fa-users"></i><p>Nuk ka klientë të regjistruar ende.</p></div>' : ''}
        </div>`;
}

window.viewCustomer = async function(id) {
    const c = await api('/api/customers/' + id);
    if (!c.id) return;
    const countryNames = { XK:'Kosovë', AL:'Shqipëri', MK:'Maqedoni', ME:'Mal i Zi', DE:'Gjermani', CH:'Zvicër', AT:'Austri' };
    alert(
        `Klienti: ${c.first_name} ${c.last_name}\n` +
        `Email: ${c.email}\n` +
        `Telefon: ${c.phone || '-'}\n` +
        `Lokacioni: ${c.city || '-'}, ${countryNames[c.country] || c.country || '-'}\n` +
        `Adresa: ${c.address || '-'}\n` +
        `Regjistruar: ${new Date(c.created_at).toLocaleDateString('sq-AL')}`
    );
};

window.deleteCustomer = async function(id, name) {
    if (!confirm(`Jeni i sigurt që doni të fshini klientin "${name}"?\n\nKjo veprim nuk mund të kthehet.`)) return;
    await api('/api/customers/' + id, { method: 'DELETE' });
    loadPage('customers');
};

// SETTINGS
async function renderSettings(el) {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    let syncStatus = { lastSync: null, interval: 3, syncCount: 0, lastPush: null, lastPull: null };
    if (isLocal) {
        try {
            syncStatus = await api('/api/sync-status');
        } catch {}
    }

    const lastSyncText = syncStatus.lastSync
        ? new Date(syncStatus.lastSync).toLocaleString('sq-AL')
        : 'Asnjëherë';

    function formatStats(stats, type) {
        if (!stats) return '<span style="color:#9ca3af;">Ende pa u ekzekutuar</span>';
        if (type === 'push') {
            const total = (stats.categories || 0) + (stats.products || 0) + (stats.customers || 0) + (stats.orders || 0);
            if (total === 0 && (stats.updated || 0) === 0) return '<span style="color:#16a34a;">Asgjë e re</span>';
            let parts = [];
            if (stats.categories > 0) parts.push(`+${stats.categories} kategori`);
            if (stats.products > 0) parts.push(`+${stats.products} produkte`);
            if (stats.customers > 0) parts.push(`+${stats.customers} klientë`);
            if (stats.orders > 0) parts.push(`+${stats.orders} porosi`);
            if (stats.updated > 0) parts.push(`${stats.updated} përditësime`);
            return `<span style="color:#16a34a;">${parts.join(', ')}</span>`;
        }
        if (type === 'pull') {
            const total = (stats.newCategories || 0) + (stats.newProducts || 0) + (stats.newCustomers || 0) + (stats.newOrders || 0);
            if (total === 0) return '<span style="color:#16a34a;">Asgjë e re</span>';
            let parts = [];
            if (stats.newCategories > 0) parts.push(`+${stats.newCategories} kategori`);
            if (stats.newProducts > 0) parts.push(`+${stats.newProducts} produkte`);
            if (stats.newCustomers > 0) parts.push(`+${stats.newCustomers} klientë`);
            if (stats.newOrders > 0) parts.push(`+${stats.newOrders} porosi`);
            return `<span style="color:#16a34a;">${parts.join(', ')}</span>`;
        }
        return '';
    }

    el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;max-width:900px;">
            <div class="admin-table-wrapper">
                <div class="table-header"><h2><i class="fas fa-lock"></i> Ndrysho Fjalëkalimin</h2></div>
                <div style="padding:1.5rem;">
                    <form id="changePasswordForm">
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label>Fjalëkalimi Aktual</label>
                            <input type="password" id="oldPassword" placeholder="••••••••" required>
                        </div>
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label>Fjalëkalimi i Ri</label>
                            <input type="password" id="newPassword" placeholder="••••••••" required minlength="6">
                        </div>
                        <div class="form-group" style="margin-bottom:1.5rem;">
                            <label>Konfirmo Fjalëkalimin e Ri</label>
                            <input type="password" id="confirmPassword" placeholder="••••••••" required minlength="6">
                        </div>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Ndrysho Fjalëkalimin</button>
                    </form>
                </div>
            </div>

            <div class="admin-table-wrapper">
                <div class="table-header"><h2><i class="fas fa-sync-alt"></i> Sinkronizimi Dy-Drejtimësh</h2></div>
                <div style="padding:1.5rem;">
                    ${isLocal ? `
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem;margin-bottom:1rem;">
                        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;">
                            <i class="fas fa-circle" style="color:${syncStatus.interval > 0 ? '#16a34a' : '#9ca3af'};font-size:.5rem;"></i>
                            <strong style="font-size:.9rem;">${syncStatus.interval > 0 ? 'Aktiv' : 'Joaktiv'}</strong>
                            <span style="font-size:.75rem;color:#9ca3af;margin-left:auto;">${syncStatus.syncCount || 0} sinkronizime</span>
                        </div>
                        <p style="font-size:.85rem;color:#6b7280;margin-bottom:.3rem;">Intervali: çdo <strong>${syncStatus.interval}</strong> minuta</p>
                        <p style="font-size:.85rem;color:#6b7280;margin-bottom:.75rem;">Fundit: <strong id="lastSyncTime">${lastSyncText}</strong></p>
                        
                        <div style="border-top:1px solid #e5e7eb;padding-top:.75rem;">
                            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;">
                                <i class="fas fa-arrow-up" style="color:#3b82f6;font-size:.75rem;"></i>
                                <span style="font-size:.8rem;font-weight:600;">Local → Online:</span>
                            </div>
                            <p style="font-size:.8rem;color:#6b7280;margin-left:1.2rem;margin-bottom:.5rem;" id="pushStatsText">${formatStats(syncStatus.lastPush, 'push')}</p>
                            
                            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;">
                                <i class="fas fa-arrow-down" style="color:#8b5cf6;font-size:.75rem;"></i>
                                <span style="font-size:.8rem;font-weight:600;">Online → Local:</span>
                            </div>
                            <p style="font-size:.8rem;color:#6b7280;margin-left:1.2rem;" id="pullStatsText">${formatStats(syncStatus.lastPull, 'pull')}</p>
                        </div>
                    </div>
                    <button class="btn btn-primary" id="syncNowBtn" onclick="triggerSync()" style="width:100%;">
                        <i class="fas fa-sync-alt"></i> Sinkronizo Tani (Dy-Drejtimësh)
                    </button>
                    <p style="font-size:.75rem;color:#9ca3af;margin-top:.75rem;text-align:center;">
                        Dërgon kategoritë, produktet, klientët dhe porositë nga lokali në internet dhe anasjelltas.
                    </p>
                    ` : `
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:1rem;margin-bottom:1rem;">
                        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;">
                            <i class="fas fa-cloud" style="color:#3b82f6;font-size:1rem;"></i>
                            <strong style="font-size:.9rem;">Serveri Online (Production)</strong>
                        </div>
                        <p style="font-size:.85rem;color:#6b7280;margin-bottom:.5rem;">
                            Ky është serveri online. Sinkronizimi automatik menaxhohet nga serveri lokal.
                        </p>
                        <p style="font-size:.85rem;color:#6b7280;margin-bottom:.5rem;">
                            Të dhënat (klientët, porositë) ruhen automatikisht gjatë çdo deploy-imi me <strong>sync.bat</strong>.
                        </p>
                    </div>
                    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:1rem;">
                        <p style="font-size:.85rem;color:#92400e;margin-bottom:.3rem;"><i class="fas fa-info-circle"></i> <strong>Si funksionon:</strong></p>
                        <ol style="font-size:.8rem;color:#92400e;padding-left:1.2rem;margin:0;">
                            <li style="margin-bottom:.2rem;">Serveri lokal sinkronizon automatikisht çdo ${syncStatus.interval || 3} minuta</li>
                            <li style="margin-bottom:.2rem;">Para deploy-imit, <strong>sync.bat</strong> eksporton të gjitha të dhënat</li>
                            <li>Pas deploy-imit, serveri i ri ngarkon kategoritë, produktet, klientët dhe porositë</li>
                        </ol>
                    </div>
                    `}
                </div>
            </div>
        </div>`;

    document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = document.getElementById('oldPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmPassword').value;
        if (newPass !== confirmPass) { alert('Fjalëkalimet e reja nuk përputhen!'); return; }
        if (newPass.length < 6) { alert('Fjalëkalimi duhet të ketë së paku 6 karaktere!'); return; }
        const res = await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }) });
        if (res.success) {
            alert('Fjalëkalimi u ndryshua me sukses!');
            document.getElementById('changePasswordForm').reset();
        } else {
            alert(res.error || 'Gabim gjatë ndryshimit të fjalëkalimit');
        }
    });
}

window.triggerSync = async function() {
    const btn = document.getElementById('syncNowBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Duke sinkronizuar...';
    btn.disabled = true;
    try {
        const res = await api('/api/sync-now', { method: 'POST' });
        if (res.success) {
            const time = res.lastSync ? new Date(res.lastSync).toLocaleString('sq-AL') : 'Tani';
            document.getElementById('lastSyncTime').textContent = time;
            showNotification('Sinkronizimi dy-drejtimësh u krye me sukses!');
            setTimeout(() => loadPage('settings'), 1000);
        } else {
            alert(res.error || 'Gabim gjatë sinkronizimit');
        }
    } catch (e) {
        alert('Gabim: ' + e.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sinkronizo Tani (Dy-Drejtimësh)';
        btn.disabled = false;
    }
};
