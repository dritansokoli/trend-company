const { getDb } = require('./database');

const RENDER_URL = process.env.RENDER_URL || 'https://trend-company.onrender.com';
const SYNC_TOKEN = process.env.SYNC_TOKEN;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL) || 3;

let syncTimer = null;
let isSyncing = false;
let lastSync = null;

async function syncFromOnline() {
    if (!SYNC_TOKEN || !RENDER_URL || process.env.NODE_ENV === 'production') return;
    if (isSyncing) return;
    isSyncing = true;

    try {
        const res = await fetch(`${RENDER_URL}/api/export?token=${SYNC_TOKEN}`, {
            signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const db = getDb();
        const stats = { newCustomers: 0, newOrders: 0 };

        const sync = db.transaction(() => {
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
                if (!existing) {
                    db.prepare(
                        'INSERT INTO orders (order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_country, items, subtotal, shipping, total, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    ).run(o.order_number, o.customer_id || null, o.customer_name, o.customer_email, o.customer_phone || '', o.customer_address || '', o.customer_city || '', o.customer_country || 'XK', JSON.stringify(o.items), o.subtotal, o.shipping, o.total, o.status, o.notes || '', o.created_at, o.updated_at);
                    stats.newOrders++;
                } else {
                    db.prepare('UPDATE orders SET status=?, updated_at=? WHERE order_number=?')
                        .run(o.status, o.updated_at, o.order_number);
                }
            }
        });

        sync();
        lastSync = new Date();

        if (stats.newCustomers > 0 || stats.newOrders > 0) {
            console.log(`[Auto-Sync] +${stats.newCustomers} klientë, +${stats.newOrders} porosi (${lastSync.toLocaleTimeString('sq-AL')})`);
        }
    } catch (e) {
        if (e.name !== 'TimeoutError' && e.name !== 'AbortError') {
            console.log(`[Auto-Sync] Gabim: ${e.message}`);
        }
    } finally {
        isSyncing = false;
    }
}

function startAutoSync() {
    if (!SYNC_TOKEN || !RENDER_URL || process.env.NODE_ENV === 'production') {
        return;
    }

    console.log(`[Auto-Sync] Aktiv - kontroll çdo ${SYNC_INTERVAL} minuta nga ${RENDER_URL}`);

    setTimeout(() => syncFromOnline(), 5000);

    syncTimer = setInterval(() => syncFromOnline(), SYNC_INTERVAL * 60 * 1000);
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

module.exports = { startAutoSync, stopAutoSync, syncFromOnline, getLastSync };
