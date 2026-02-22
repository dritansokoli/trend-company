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
        case 'orders': title.textContent = 'Porositë'; renderOrders(content); break;
        case 'customers': title.textContent = 'Klientët'; await renderCustomers(content); break;
        case 'settings': title.textContent = 'Cilësimet'; renderSettings(content); break;
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

function renderOrders(el) {
    el.innerHTML = '<div class="admin-table-wrapper"><div class="table-header"><h2>Porositë</h2></div><div class="empty-state"><i class="fas fa-shopping-bag"></i><p>Porositë do të shfaqen këtu.</p></div></div>';
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
function renderSettings(el) {
    el.innerHTML = `
        <div class="admin-table-wrapper" style="max-width:500px;">
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
