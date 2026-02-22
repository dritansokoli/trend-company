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
    res.json({ totalCats, totalSubs, totalProds, avgPrice, totalStock, outOfStock, lowStock, stockValue, totalCustomers });
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

    res.json({
        exported_at: new Date().toISOString(),
        categories,
        products,
        customers
    });
});

module.exports = router;
