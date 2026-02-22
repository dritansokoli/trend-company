const { getDb } = require('./database');

const RENDER_URL = process.env.RENDER_URL || 'https://trend-company.onrender.com';
const SYNC_TOKEN = process.env.SYNC_TOKEN;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || 3;

let syncTimer = null;
let isSyncing = false;
let lastSync = null;
let syncCount = 0;
let lastPushStats = null;
let lastPullStats = null;

function getLocalData() {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
    const products = db.prepare('SELECT * FROM products ORDER BY id').all().map(p => ({
        ...p, features: JSON.parse(p.features || '[]')
    }));
    const customers = db.prepare('SELECT id, first_name, last_name, email, phone, country, city, address, created_at FROM customers ORDER BY id').all();
    const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all().map(o => ({
        ...o, items: JSON.parse(o.items || '[]')
    }));
    return { categories, products, customers, orders };
}

async function pushToOnline() {
    const localData = getLocalData();

    const res = await fetch(`${RENDER_URL}/api/import?token=${SYNC_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localData),
        signal: AbortSignal.timeout(60000)
    });

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    const result = await res.json();
    lastPushStats = result.stats || {};
    return lastPushStats;
}

async function pullFromOnline() {
    const res = await fetch(`${RENDER_URL}/api/export?token=${SYNC_TOKEN}`, {
        signal: AbortSignal.timeout(60000)
    });

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const db = getDb();
    const stats = { newCategories: 0, newProducts: 0, newCustomers: 0, newOrders: 0, updatedOrders: 0, updatedProducts: 0 };

    const sync = db.transaction(() => {
        for (const cat of (data.categories || [])) {
            const existing = db.prepare('SELECT id FROM categories WHERE key = ?').get(cat.key);
            if (!existing) {
                db.prepare('INSERT INTO categories (key, name, icon, parent_id) VALUES (?, ?, ?, ?)')
                    .run(cat.key, cat.name, cat.icon || 'fa-box', cat.parent_id || null);
                stats.newCategories++;
            }
        }

        for (const p of (data.products || [])) {
            const existing = db.prepare('SELECT id FROM products WHERE name = ? AND sub_category_key = ?').get(p.name, p.sub_category_key);
            const featuresJson = Array.isArray(p.features) ? JSON.stringify(p.features) : (p.features || '[]');
            if (!existing) {
                db.prepare(
                    'INSERT INTO products (name, main_category_key, sub_category_key, price, type, description, icon, features, image, stock, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).run(p.name, p.main_category_key, p.sub_category_key, p.price, p.type || 'standard', p.description || '', p.icon || 'fa-box', featuresJson, p.image || '', p.stock || 0, p.stock_min || 5);
                stats.newProducts++;
            }
        }

        for (const c of (data.customers || [])) {
            const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(c.email);
            if (!existing) {
                db.prepare(
                    'INSERT INTO customers (first_name, last_name, email, password_hash, phone, country, city, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).run(c.first_name, c.last_name, c.email, '---synced---', c.phone || '', c.country || 'XK', c.city || '', c.address || '', c.created_at);
                stats.newCustomers++;
            }
        }

        for (const o of (data.orders || [])) {
            const existing = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(o.order_number);
            const itemsJson = Array.isArray(o.items) ? JSON.stringify(o.items) : (o.items || '[]');
            if (!existing) {
                db.prepare(
                    'INSERT INTO orders (order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_country, items, subtotal, shipping, total, status, payment_method, payment_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).run(o.order_number, o.customer_id || null, o.customer_name, o.customer_email, o.customer_phone || '', o.customer_address || '', o.customer_city || '', o.customer_country || 'XK', itemsJson, o.subtotal, o.shipping, o.total, o.status, o.payment_method || 'cod', o.payment_status || 'unpaid', o.notes || '', o.created_at, o.updated_at);
                stats.newOrders++;
            } else {
                db.prepare('UPDATE orders SET status=?, payment_status=?, updated_at=? WHERE order_number=?')
                    .run(o.status, o.payment_status || 'unpaid', o.updated_at, o.order_number);
                stats.updatedOrders++;
            }
        }
    });

    sync();
    lastPullStats = stats;
    return stats;
}

async function syncBidirectional() {
    if (!SYNC_TOKEN || !RENDER_URL || process.env.NODE_ENV === 'production') return;
    if (isSyncing) return;
    isSyncing = true;
    syncCount++;

    const time = new Date().toLocaleTimeString('sq-AL');
    console.log(`[Auto-Sync] #${syncCount} Duke sinkronizuar... (${time})`);

    try {
        console.log(`[Auto-Sync]   ↑ Duke dërguar te dhënat lokale → online...`);
        const pushStats = await pushToOnline();
        const pushNew = (pushStats.categories || 0) + (pushStats.products || 0) + (pushStats.customers || 0) + (pushStats.orders || 0);
        const pushUpdated = pushStats.updated || 0;
        if (pushNew > 0 || pushUpdated > 0) {
            console.log(`[Auto-Sync]   ↑ ✓ Dërguar: +${pushStats.categories || 0} kategori, +${pushStats.products || 0} produkte, +${pushStats.customers || 0} klientë, +${pushStats.orders || 0} porosi (${pushUpdated} përditësime)`);
        } else {
            console.log(`[Auto-Sync]   ↑ ✓ Asgjë e re për dërgim`);
        }
    } catch (e) {
        if (e.name === 'AbortError' || e.name === 'TimeoutError') {
            console.log(`[Auto-Sync]   ↑ ✗ Timeout - serveri online nuk u përgjigj`);
        } else {
            console.log(`[Auto-Sync]   ↑ ✗ Gabim push: ${e.message}`);
        }
    }

    try {
        console.log(`[Auto-Sync]   ↓ Duke shkarkuar të dhënat online → lokal...`);
        const pullStats = await pullFromOnline();
        const pullNew = pullStats.newCategories + pullStats.newProducts + pullStats.newCustomers + pullStats.newOrders;
        if (pullNew > 0) {
            console.log(`[Auto-Sync]   ↓ ✓ Shkarkuar: +${pullStats.newCategories} kategori, +${pullStats.newProducts} produkte, +${pullStats.newCustomers} klientë, +${pullStats.newOrders} porosi`);
        } else {
            console.log(`[Auto-Sync]   ↓ ✓ Asgjë e re për shkarkim`);
        }
    } catch (e) {
        if (e.name === 'AbortError' || e.name === 'TimeoutError') {
            console.log(`[Auto-Sync]   ↓ ✗ Timeout - serveri online nuk u përgjigj`);
        } else {
            console.log(`[Auto-Sync]   ↓ ✗ Gabim pull: ${e.message}`);
        }
    }

    lastSync = new Date();
    isSyncing = false;
    console.log(`[Auto-Sync] #${syncCount} Përfundoi (${lastSync.toLocaleTimeString('sq-AL')})`);
}

function startAutoSync() {
    if (!SYNC_TOKEN) {
        console.log('[Auto-Sync] JOAKTIV - SYNC_TOKEN mungon në .env');
        return;
    }
    if (!RENDER_URL) {
        console.log('[Auto-Sync] JOAKTIV - RENDER_URL mungon në .env');
        return;
    }
    if (process.env.NODE_ENV === 'production') {
        return;
    }

    console.log(`[Auto-Sync] Aktiv (dy-drejtimësh) - çdo ${SYNC_INTERVAL} min`);
    console.log(`[Auto-Sync]   ↑ Local → ${RENDER_URL}`);
    console.log(`[Auto-Sync]   ↓ ${RENDER_URL} → Local`);
    console.log(`[Auto-Sync] Kontrolli i parë pas 5 sekondash...`);

    setTimeout(() => syncBidirectional(), 5000);
    syncTimer = setInterval(() => syncBidirectional(), SYNC_INTERVAL * 60 * 1000);
}

function stopAutoSync() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}

function getLastSync() {
    return lastSync;
}

function getSyncStats() {
    return {
        lastSync,
        syncCount,
        lastPush: lastPushStats,
        lastPull: lastPullStats
    };
}

module.exports = { startAutoSync, stopAutoSync, syncFromOnline: syncBidirectional, getLastSync, getSyncStats };
