const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E6);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
}});

function requireAdmin(req, res, next) {
    if (req.session?.userId) return next();
    res.status(401).json({ error: 'Nuk jeni i autorizuar' });
}

// === CATEGORIES ===

router.get('/categories', (req, res) => {
    const db = getDb();
    const all = db.prepare('SELECT * FROM categories ORDER BY id').all();
    const mainCats = all.filter(c => c.parent_id === null);
    const result = {};
    for (const mc of mainCats) {
        const subs = all.filter(c => c.parent_id === mc.id);
        const subcategories = {};
        for (const s of subs) {
            subcategories[s.key] = { id: s.id, name: s.name, icon: s.icon };
        }
        result[mc.key] = { id: mc.id, name: mc.name, icon: mc.icon, subcategories };
    }
    res.json(result);
});

router.post('/categories', requireAdmin, (req, res) => {
    const { key, name, icon, parentId } = req.body;
    if (!key || !name) return res.status(400).json({ error: 'Emri dhe çelësi janë të detyrueshme' });
    const db = getDb();
    try {
        const result = db.prepare('INSERT INTO categories (key, name, icon, parent_id) VALUES (?, ?, ?, ?)')
            .run(key, name, icon || 'fa-box', parentId || null);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (e) {
        res.status(400).json({ error: 'Çelësi ekziston tashmë' });
    }
});

router.put('/categories/:id', requireAdmin, (req, res) => {
    const { name, icon } = req.body;
    const db = getDb();
    db.prepare('UPDATE categories SET name = ?, icon = ? WHERE id = ?').run(name, icon, req.params.id);
    res.json({ success: true });
});

router.delete('/categories/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Nuk u gjet' });

    if (cat.parent_id === null) {
        const subs = db.prepare('SELECT key FROM categories WHERE parent_id = ?').all(cat.id);
        const subKeys = subs.map(s => s.key);
        if (subKeys.length > 0) {
            const placeholders = subKeys.map(() => '?').join(',');
            db.prepare(`DELETE FROM products WHERE main_category_key = ? OR sub_category_key IN (${placeholders})`).run(cat.key, ...subKeys);
        } else {
            db.prepare('DELETE FROM products WHERE main_category_key = ?').run(cat.key);
        }
        db.prepare('DELETE FROM categories WHERE parent_id = ?').run(cat.id);
    } else {
        db.prepare('DELETE FROM products WHERE sub_category_key = ?').run(cat.key);
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    res.json({ success: true });
});

// === PRODUCTS ===

router.get('/products', (req, res) => {
    const db = getDb();
    const { mainCategory, subCategory } = req.query;
    let rows;
    if (subCategory) {
        rows = db.prepare('SELECT * FROM products WHERE sub_category_key = ? ORDER BY id DESC').all(subCategory);
    } else if (mainCategory) {
        rows = db.prepare('SELECT * FROM products WHERE main_category_key = ? ORDER BY id DESC').all(mainCategory);
    } else {
        rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
    }
    const products = rows.map(r => ({
        ...r,
        features: JSON.parse(r.features || '[]'),
        image: r.image ? `/uploads/${r.image}` : ''
    }));
    res.json(products);
});

router.get('/products/:id', (req, res) => {
    const db = getDb();
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Nuk u gjet' });
    p.features = JSON.parse(p.features || '[]');
    p.image = p.image ? `/uploads/${p.image}` : '';
    res.json(p);
});

router.post('/products', requireAdmin, upload.single('image'), (req, res) => {
    const { name, main_category_key, sub_category_key, price, type, description, icon, features, stock, stock_min } = req.body;
    if (!name || !main_category_key || !sub_category_key || !price) {
        return res.status(400).json({ error: 'Plotëso fushat e nevojshme' });
    }
    const db = getDb();
    const imageName = req.file ? req.file.filename : '';
    const featuresJson = features ? (typeof features === 'string' ? features : JSON.stringify(features)) : '[]';

    const result = db.prepare(
        'INSERT INTO products (name, main_category_key, sub_category_key, price, type, description, icon, features, image, stock, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, main_category_key, sub_category_key, parseFloat(price), type || 'standard', description || '', icon || 'fa-box', featuresJson, imageName, parseInt(stock) || 0, parseInt(stock_min) || 5);

    res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/products/:id', requireAdmin, upload.single('image'), (req, res) => {
    const { name, main_category_key, sub_category_key, price, type, description, icon, features, stock, stock_min } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Nuk u gjet' });

    let imageName = existing.image;
    if (req.file) {
        if (existing.image) {
            const oldPath = path.join(uploadsDir, existing.image);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        imageName = req.file.filename;
    }

    const featuresJson = features ? (typeof features === 'string' ? features : JSON.stringify(features)) : existing.features;

    db.prepare(
        'UPDATE products SET name=?, main_category_key=?, sub_category_key=?, price=?, type=?, description=?, icon=?, features=?, image=?, stock=?, stock_min=? WHERE id=?'
    ).run(name || existing.name, main_category_key || existing.main_category_key, sub_category_key || existing.sub_category_key,
        parseFloat(price) || existing.price, type || existing.type, description ?? existing.description,
        icon || existing.icon, featuresJson, imageName,
        stock !== undefined ? parseInt(stock) : existing.stock,
        stock_min !== undefined ? parseInt(stock_min) : existing.stock_min,
        req.params.id);

    res.json({ success: true });
});

router.patch('/products/:id/stock', requireAdmin, (req, res) => {
    const { change, absolute } = req.body;
    const db = getDb();
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Nuk u gjet' });

    if (absolute !== undefined) {
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(parseInt(absolute), req.params.id);
    } else if (change !== undefined) {
        const newStock = Math.max(0, p.stock + parseInt(change));
        db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, req.params.id);
    }

    const updated = db.prepare('SELECT stock, stock_min FROM products WHERE id = ?').get(req.params.id);
    res.json({ success: true, stock: updated.stock, stock_min: updated.stock_min });
});

router.delete('/products/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Nuk u gjet' });

    if (p.image) {
        const imgPath = path.join(uploadsDir, p.image);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// === ORDERS ===

function generateOrderNumber() {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `TC-${y}${m}${d}-${rand}`;
}

router.post('/orders', (req, res) => {
    const { customer_name, customer_email, customer_phone, customer_address, customer_city, customer_country, items, notes, payment_method } = req.body;
    if (!customer_name || !customer_email || !customer_phone || !items || !items.length) {
        return res.status(400).json({ error: 'Plotëso fushat e nevojshme' });
    }

    const validPayment = ['cod', 'bank', 'card'];
    const pm = validPayment.includes(payment_method) ? payment_method : 'cod';

    const db = getDb();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 100 ? 0 : 5;
    const total = subtotal + shipping;

    const orderNumber = generateOrderNumber();
    const customerId = req.session?.customerId || null;
    const paymentStatus = pm === 'card' ? 'awaiting' : 'unpaid';

    const updateStock = db.transaction(() => {
        for (const item of items) {
            const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.id);
            if (product) {
                const newStock = Math.max(0, product.stock - item.quantity);
                db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, item.id);
            }
        }
    });

    try {
        const result = db.prepare(
            'INSERT INTO orders (order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_country, items, subtotal, shipping, total, payment_method, payment_status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(orderNumber, customerId, customer_name, customer_email, customer_phone, customer_address || '', customer_city || '', customer_country || 'XK', JSON.stringify(items), subtotal, shipping, total, pm, paymentStatus, notes || '');

        updateStock();

        res.json({ success: true, order_number: orderNumber, order_id: Number(result.lastInsertRowid), total, payment_method: pm });
    } catch (e) {
        console.error('Order creation error:', e.message);
        res.status(500).json({ error: 'Gabim gjatë krijimit të porosisë' });
    }
});

router.patch('/orders/:id/payment', requireAdmin, (req, res) => {
    const { payment_status } = req.body;
    const valid = ['unpaid', 'paid', 'refunded'];
    if (!valid.includes(payment_status)) return res.status(400).json({ error: 'Status i pavlefshëm' });
    const db = getDb();
    db.prepare('UPDATE orders SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(payment_status, req.params.id);
    res.json({ success: true });
});

router.get('/orders', requireAdmin, (req, res) => {
    const db = getDb();
    const { status } = req.query;
    let orders;
    if (status && status !== 'all') {
        orders = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(status);
    } else {
        orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    }
    res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })));
});

router.get('/orders/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Nuk u gjet' });
    order.items = JSON.parse(order.items || '[]');
    res.json(order);
});

router.patch('/orders/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Status i pavlefshëm' });
    }
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Nuk u gjet' });

    if (status === 'cancelled' && order.status !== 'cancelled') {
        const items = JSON.parse(order.items || '[]');
        const restoreStock = db.transaction(() => {
            for (const item of items) {
                db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.id);
            }
        });
        restoreStock();
    }

    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
});

router.delete('/orders/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Nuk u gjet' });
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// === STATS ===

router.get('/stats', requireAdmin, (req, res) => {
    const db = getDb();
    const totalCats = db.prepare('SELECT COUNT(*) as c FROM categories WHERE parent_id IS NULL').get().c;
    const totalSubs = db.prepare('SELECT COUNT(*) as c FROM categories WHERE parent_id IS NOT NULL').get().c;
    const totalProds = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
    const avgPrice = db.prepare('SELECT AVG(price) as avg FROM products').get().avg || 0;
    const totalStock = db.prepare('SELECT SUM(stock) as s FROM products').get().s || 0;
    const outOfStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock = 0').get().c;
    const lowStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE stock > 0 AND stock <= stock_min').get().c;
    const stockValue = db.prepare('SELECT SUM(stock * price) as v FROM products').get().v || 0;
    const totalCustomers = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c;
    const totalRevenue = db.prepare("SELECT SUM(total) as t FROM orders WHERE status NOT IN ('cancelled')").get().t || 0;
    const todayOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get().c;
    res.json({ totalCats, totalSubs, totalProds, avgPrice, totalStock, outOfStock, lowStock, stockValue, totalCustomers, totalOrders, pendingOrders, totalRevenue, todayOrders });
});

// === CUSTOMERS (admin) ===

router.get('/customers', requireAdmin, (req, res) => {
    const db = getDb();
    const customers = db.prepare('SELECT id, first_name, last_name, email, phone, country, city, address, created_at FROM customers ORDER BY id DESC').all();
    res.json(customers);
});

router.get('/customers/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const c = db.prepare('SELECT id, first_name, last_name, email, phone, country, city, address, created_at FROM customers WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Nuk u gjet' });
    res.json(c);
});

router.delete('/customers/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const c = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Nuk u gjet' });
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// === MANUAL SYNC TRIGGER ===

router.post('/sync-now', requireAdmin, async (req, res) => {
    try {
        const { syncFromOnline, getSyncStats } = require('../auto-sync');
        const result = await syncFromOnline();
        const stats = getSyncStats();
        if (result && !result.success && result.error) {
            return res.json({ success: false, error: result.error, ...stats });
        }
        res.json({
            success: true,
            pushOk: result?.pushOk ?? false,
            pullOk: result?.pullOk ?? false,
            pushError: result?.pushError || null,
            pullError: result?.pullError || null,
            ...stats
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/sync-status', requireAdmin, (req, res) => {
    try {
        const { getSyncStats } = require('../auto-sync');
        const stats = getSyncStats();
        res.json({ ...stats, interval: parseInt(process.env.SYNC_INTERVAL) || 3 });
    } catch (e) {
        res.json({ lastSync: null, interval: 0, syncCount: 0 });
    }
});

// === SYNC EXPORT (protected with token) ===

router.get('/export', (req, res) => {
    const token = req.headers['x-sync-token'] || req.query.token;
    const serverToken = process.env.SYNC_TOKEN;
    if (!serverToken || token !== serverToken) {
        return res.status(403).json({ error: 'Token i pavlefshëm' });
    }

    const db = getDb();
    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
    const products = db.prepare('SELECT * FROM products ORDER BY id').all().map(p => ({
        ...p, features: JSON.parse(p.features || '[]')
    }));
    const customers = db.prepare('SELECT id, first_name, last_name, email, phone, country, city, address, created_at FROM customers ORDER BY id').all();
    const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all().map(o => ({
        ...o, items: JSON.parse(o.items || '[]')
    }));

    res.json({
        exported_at: new Date().toISOString(),
        categories,
        products,
        customers,
        orders
    });
});

// === SYNC IMPORT (protected with token) ===

router.post('/import', express.json({ limit: '50mb' }), (req, res) => {
    const token = req.headers['x-sync-token'] || req.query.token;
    const serverToken = process.env.SYNC_TOKEN;
    if (!serverToken || token !== serverToken) {
        return res.status(403).json({ error: 'Token i pavlefshëm' });
    }

    const { categories, products, customers, orders } = req.body;
    const db = getDb();
    const stats = { categories: 0, products: 0, customers: 0, orders: 0, updated: 0 };

    try {
        const importAll = db.transaction(() => {
            if (categories && categories.length > 0) {
                for (const cat of categories) {
                    const existing = db.prepare('SELECT id FROM categories WHERE key = ?').get(cat.key);
                    if (!existing) {
                        db.prepare('INSERT INTO categories (key, name, icon, parent_id) VALUES (?, ?, ?, ?)')
                            .run(cat.key, cat.name, cat.icon || 'fa-box', cat.parent_id || null);
                        stats.categories++;
                    } else {
                        db.prepare('UPDATE categories SET name = ?, icon = ? WHERE key = ?')
                            .run(cat.name, cat.icon || 'fa-box', cat.key);
                    }
                }
            }

            if (products && products.length > 0) {
                for (const p of products) {
                    const existing = db.prepare('SELECT id FROM products WHERE name = ? AND sub_category_key = ?').get(p.name, p.sub_category_key);
                    const featuresJson = Array.isArray(p.features) ? JSON.stringify(p.features) : (p.features || '[]');
                    if (!existing) {
                        db.prepare(
                            'INSERT INTO products (name, main_category_key, sub_category_key, price, type, description, icon, features, image, stock, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                        ).run(p.name, p.main_category_key, p.sub_category_key, p.price, p.type || 'standard', p.description || '', p.icon || 'fa-box', featuresJson, p.image || '', p.stock || 0, p.stock_min || 5);
                        stats.products++;
                    } else {
                        db.prepare(
                            'UPDATE products SET price=?, description=?, icon=?, features=?, stock=?, stock_min=? WHERE id=?'
                        ).run(p.price, p.description || '', p.icon || 'fa-box', featuresJson, p.stock || 0, p.stock_min || 5, existing.id);
                        stats.updated++;
                    }
                }
            }

            if (customers && customers.length > 0) {
                for (const c of customers) {
                    const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(c.email);
                    if (!existing) {
                        db.prepare(
                            'INSERT INTO customers (first_name, last_name, email, password_hash, phone, country, city, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                        ).run(c.first_name, c.last_name, c.email, c.password_hash || '---synced---', c.phone || '', c.country || 'XK', c.city || '', c.address || '', c.created_at || new Date().toISOString());
                        stats.customers++;
                    }
                }
            }

            if (orders && orders.length > 0) {
                for (const o of orders) {
                    const existing = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(o.order_number);
                    const itemsJson = Array.isArray(o.items) ? JSON.stringify(o.items) : (o.items || '[]');
                    if (!existing) {
                        db.prepare(
                            'INSERT INTO orders (order_number, customer_id, customer_name, customer_email, customer_phone, customer_address, customer_city, customer_country, items, subtotal, shipping, total, status, payment_method, payment_status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                        ).run(o.order_number, o.customer_id || null, o.customer_name, o.customer_email, o.customer_phone || '', o.customer_address || '', o.customer_city || '', o.customer_country || 'XK', itemsJson, o.subtotal, o.shipping, o.total, o.status, o.payment_method || 'cod', o.payment_status || 'unpaid', o.notes || '', o.created_at, o.updated_at);
                        stats.orders++;
                    } else {
                        db.prepare('UPDATE orders SET status=?, payment_status=?, updated_at=? WHERE order_number=?')
                            .run(o.status, o.payment_status || 'unpaid', o.updated_at, o.order_number);
                        stats.updated++;
                    }
                }
            }
        });

        importAll();
        res.json({ success: true, stats });
    } catch (e) {
        console.error('Import error:', e.message);
        res.status(500).json({ error: 'Gabim gjatë importimit: ' + e.message });
    }
});

module.exports = router;
