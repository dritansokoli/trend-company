const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');
let db;

function getDb() {
    if (!db) {
        fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

function initDatabase() {
    const db = getDb();

    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            icon TEXT DEFAULT 'fa-box',
            parent_id INTEGER DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            main_category_key TEXT NOT NULL,
            sub_category_key TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0,
            type TEXT DEFAULT 'standard',
            description TEXT DEFAULT '',
            icon TEXT DEFAULT 'fa-box',
            features TEXT DEFAULT '[]',
            image TEXT DEFAULT '',
            stock INTEGER NOT NULL DEFAULT 0,
            stock_min INTEGER NOT NULL DEFAULT 5,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            phone TEXT DEFAULT '',
            country TEXT DEFAULT 'XK',
            city TEXT DEFAULT '',
            address TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Auto-migrate: add stock columns if they don't exist yet
    const cols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
    if (!cols.includes('stock')) {
        db.exec('ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0');
        db.exec('ALTER TABLE products ADD COLUMN stock_min INTEGER NOT NULL DEFAULT 5');
    }

    // Auto-migrate: ensure customers table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'").get();
    if (!tables) {
        db.exec(`CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            phone TEXT DEFAULT '',
            country TEXT DEFAULT 'XK',
            city TEXT DEFAULT '',
            address TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('Customers table created (migration)');
    }

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
        console.log('Default admin user created (admin / admin123)');
    }

    const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (catCount.count === 0) {
        const seedPath = path.join(__dirname, 'data', 'seed-data.json');
        if (fs.existsSync(seedPath)) {
            importSeedData(db, seedPath);
            console.log('Data imported from seed-data.json');
        } else {
            seedDefaultData(db);
            console.log('Default categories and products seeded');
        }
    }
}

function seedDefaultData(db) {
    const insertCat = db.prepare('INSERT INTO categories (key, name, icon, parent_id) VALUES (?, ?, ?, ?)');

    const mainCats = [
        { key: 'dyer', name: 'Dyer', icon: 'fa-door-open', subs: [
            { key: 'brendshme', name: 'Brendshme', icon: 'fa-door-closed' },
            { key: 'jashtme', name: 'Jashtme', icon: 'fa-door-open' },
            { key: 'blinduar', name: 'Blinduara', icon: 'fa-shield-halved' },
            { key: 'rrëshqitëse', name: 'Rrëshqitëse', icon: 'fa-arrows-left-right' }
        ]},
        { key: 'laminat', name: 'Laminat', icon: 'fa-layer-group', subs: [
            { key: 'laminat-druri', name: 'Laminat Druri', icon: 'fa-tree' },
            { key: 'laminat-modern', name: 'Laminat Modern', icon: 'fa-palette' },
            { key: 'laminat-standard', name: 'Laminat Standard', icon: 'fa-layer-group' }
        ]},
        { key: 'mobilje', name: 'Mobilje', icon: 'fa-couch', subs: [
            { key: 'gardëroba', name: 'Gardëroba', icon: 'fa-box-open' },
            { key: 'krevate', name: 'Krevate', icon: 'fa-bed' },
            { key: 'komodina', name: 'Komodina', icon: 'fa-box-open' },
            { key: 'rafte', name: 'Rafte & Dollape', icon: 'fa-tv' }
        ]},
        { key: 'tavolina-kuzhine', name: 'Tavolina Kuzhine', icon: 'fa-utensils', subs: [
            { key: 'tk-druri', name: 'Druri', icon: 'fa-tree' },
            { key: 'tk-moderne', name: 'Moderne', icon: 'fa-utensils' },
            { key: 'tk-set', name: 'Set Komplet', icon: 'fa-chair' }
        ]},
        { key: 'tavolina-salloni', name: 'Tavolina Salloni', icon: 'fa-mug-hot', subs: [
            { key: 'ts-xham', name: 'Xham', icon: 'fa-wine-glass' },
            { key: 'ts-druri', name: 'Druri', icon: 'fa-tree' },
            { key: 'ts-moderne', name: 'Moderne', icon: 'fa-couch' }
        ]}
    ];

    const insertMany = db.transaction(() => {
        for (const mc of mainCats) {
            const result = insertCat.run(mc.key, mc.name, mc.icon, null);
            const parentId = result.lastInsertRowid;
            for (const sub of mc.subs) {
                insertCat.run(sub.key, sub.name, sub.icon, parentId);
            }
        }
    });
    insertMany();

    const defaultProducts = [
        { name: 'Derë e Brendshme Premium Laminat', mc: 'dyer', sc: 'brendshme', price: 189, type: 'premium', desc: 'Derë e brendshme premium me laminat të cilësisë së lartë.', icon: 'fa-door-closed', features: ['Laminat premium','80x200 cm','40 mm','Kornizë alumini','Izolim akustik'], stock: 15, stockMin: 5 },
        { name: 'Derë e Brendshme Klasike Druri', mc: 'dyer', sc: 'brendshme', price: 145, type: 'standard', desc: 'Derë klasike prej druri natyror me përfundim elegant.', icon: 'fa-door-closed', features: ['Dru natyral','80x200 cm','35 mm','Përfundim me llak','Rezistente'], stock: 22, stockMin: 5 },
        { name: 'Derë e Blinduar Siguria Maksimale', mc: 'dyer', sc: 'blinduar', price: 890, type: 'premium', desc: 'Derë e blinduar me nivel të lartë sigurie.', icon: 'fa-shield-halved', features: ['Çelik i fortifikuar','Bravë multicenter','Klasë sigurie 4','Izolim termik'], stock: 5, stockMin: 3 },
        { name: 'Derë e Blinduar Elegante', mc: 'dyer', sc: 'blinduar', price: 1250, type: 'premium', desc: 'Derë e blinduar ekskluzive me dizajn elegant.', icon: 'fa-shield-halved', features: ['Çelik inox','Bravë elektronike','Klasë sigurie 5','Izolim akustik'], stock: 3, stockMin: 3 },
        { name: 'Derë e Jashtme PVC me Xham', mc: 'dyer', sc: 'jashtme', price: 420, type: 'premium', desc: 'Derë e jashtme PVC me xham dekorativ.', icon: 'fa-door-open', features: ['PVC 5-dhomësh','Xham dyshtresor','Rezistente ndaj motit','Izolim termik'], stock: 8, stockMin: 3 },
        { name: 'Derë e Jashtme Alumini', mc: 'dyer', sc: 'jashtme', price: 580, type: 'premium', desc: 'Derë hyrëse prej alumini me dizajn modern.', icon: 'fa-door-open', features: ['Alumin premium','Izolim termik','Rezistente UV','Dorezë e integruar'], stock: 6, stockMin: 3 },
        { name: 'Derë Rrëshqitëse me Xham', mc: 'dyer', sc: 'rrëshqitëse', price: 650, type: 'premium', desc: 'Derë rrëshqitëse me xham të temperuar.', icon: 'fa-arrows-left-right', features: ['Xham 8mm','Sistem silent','90x210 cm','Dizajn minimalist'], stock: 4, stockMin: 2 },
        { name: 'Derë Rrëshqitëse në Mur', mc: 'dyer', sc: 'rrëshqitëse', price: 350, type: 'standard', desc: 'Derë rrëshqitëse që futet brenda murit.', icon: 'fa-arrows-left-right', features: ['Sistem brenda murit','Laminat cilësor','Kursim hapësire'], stock: 0, stockMin: 3 },
        { name: 'Laminat Druri Lisi AC5 8mm', mc: 'laminat', sc: 'laminat-druri', price: 12, type: 'premium', desc: 'Laminat premium me pamje druri lisi natyral.', icon: 'fa-layer-group', features: ['AC5','8mm','Druri lisi','Rezistent lagështirës','Sistem click'], stock: 250, stockMin: 50 },
        { name: 'Laminat Gri Modern AC5 10mm', mc: 'laminat', sc: 'laminat-modern', price: 16, type: 'premium', desc: 'Laminat modern me ngjyrë gri elegante.', icon: 'fa-layer-group', features: ['AC5','10mm','Gri moderne','Izolim akustik','Antistatik'], stock: 180, stockMin: 50 },
        { name: 'Laminat Druri Arrë AC4 8mm', mc: 'laminat', sc: 'laminat-standard', price: 10, type: 'standard', desc: 'Laminat me pamje druri arrë me nuancë të ngrohtë.', icon: 'fa-layer-group', features: ['AC4','8mm','Druri arrë','Rezistent UV'], stock: 30, stockMin: 50 },
        { name: 'Gardërobë Moderne me Dyer Rrëshqitëse', mc: 'mobilje', sc: 'gardëroba', price: 680, type: 'premium', desc: 'Gardërobë e gjerë me dyer rrëshqitëse dhe pasqyrë.', icon: 'fa-box-open', features: ['Dyer rrëshqitëse','200x220x60 cm','MDF premium','Silent-close'], stock: 7, stockMin: 3 },
        { name: 'Krevat Dyshek 160x200 me Magazinë', mc: 'mobilje', sc: 'krevate', price: 520, type: 'premium', desc: 'Krevat modern me hapësirë magazinimi.', icon: 'fa-bed', features: ['160x200 cm','Magazinë nën dyshek','Mekanizëm hidraulik'], stock: 10, stockMin: 3 },
        { name: 'Komodë me 4 Sirtar Druri', mc: 'mobilje', sc: 'komodina', price: 245, type: 'standard', desc: 'Komodë elegante me 4 sirtarë prej druri.', icon: 'fa-box-open', features: ['4 sirtarë','80x100x45 cm','Dru natyral','Doreza metalike'], stock: 12, stockMin: 5 },
        { name: 'Dollap TV Modern 180cm', mc: 'mobilje', sc: 'rafte', price: 390, type: 'premium', desc: 'Dollap TV modern me dritë LED.', icon: 'fa-tv', features: ['180 cm','Dritë LED','Hapësirë kabllo','Laminat premium'], stock: 9, stockMin: 3 },
        { name: 'Tavolinë Kuzhine Druri 120x80cm', mc: 'tavolina-kuzhine', sc: 'tk-druri', price: 280, type: 'standard', desc: 'Tavolinë kuzhine prej druri masiv.', icon: 'fa-utensils', features: ['Dru masiv lisi','120x80 cm','4-6 persona','Llak natyral'], stock: 14, stockMin: 5 },
        { name: 'Tavolinë Kuzhine e Zgjatshme', mc: 'tavolina-kuzhine', sc: 'tk-moderne', price: 450, type: 'premium', desc: 'Tavolinë kuzhine me zgjerim 140-180cm.', icon: 'fa-utensils', features: ['140-180 cm','6-8 persona','MDF premium','Këmbë metalike'], stock: 2, stockMin: 3 },
        { name: 'Set Tavolinë + 4 Karrige', mc: 'tavolina-kuzhine', sc: 'tk-set', price: 590, type: 'premium', desc: 'Set komplet tavolinë me 4 karrige skandinave.', icon: 'fa-chair', features: ['120x80 cm','4 karrige','Stil skandinav','Dru + metal'], stock: 6, stockMin: 3 },
        { name: 'Tavolinë Salloni Ovale Xham', mc: 'tavolina-salloni', sc: 'ts-xham', price: 320, type: 'premium', desc: 'Tavolinë salloni ovale me xham të temperuar.', icon: 'fa-couch', features: ['Xham 10mm','Ovale','Bazë metalike ari','110x60 cm'], stock: 11, stockMin: 3 },
        { name: 'Tavolinë Salloni Druri Natyral', mc: 'tavolina-salloni', sc: 'ts-druri', price: 195, type: 'standard', desc: 'Tavolinë salloni prej druri natyral.', icon: 'fa-couch', features: ['Dru lisi','100x55 cm','Raft shtesë','Vaj druri'], stock: 18, stockMin: 5 },
        { name: 'Tavolinë Salloni Moderne E Zezë', mc: 'tavolina-salloni', sc: 'ts-moderne', price: 275, type: 'premium', desc: 'Tavolinë salloni moderne e zezë mat.', icon: 'fa-couch', features: ['E zezë mat','90x90 cm','Dizajn gjeometrik','Me raft'], stock: 0, stockMin: 5 },
    ];

    const insertProd = db.prepare('INSERT INTO products (name, main_category_key, sub_category_key, price, type, description, icon, features, stock, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertProds = db.transaction(() => {
        for (const p of defaultProducts) {
            insertProd.run(p.name, p.mc, p.sc, p.price, p.type, p.desc, p.icon, JSON.stringify(p.features), p.stock, p.stockMin);
        }
    });
    insertProds();
}

function importSeedData(db, seedPath) {
    const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    const insertCat = db.prepare('INSERT INTO categories (key, name, icon, parent_id) VALUES (?, ?, ?, ?)');
    const insertProd = db.prepare(
        'INSERT INTO products (name, main_category_key, sub_category_key, price, type, description, icon, features, image, stock, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const importAll = db.transaction(() => {
        const idMap = {};

        const mainCats = data.categories.filter(c => c.parent_id === null);
        const subCats = data.categories.filter(c => c.parent_id !== null);

        for (const cat of mainCats) {
            const result = insertCat.run(cat.key, cat.name, cat.icon, null);
            idMap[cat.id] = result.lastInsertRowid;
        }

        for (const sub of subCats) {
            const newParentId = idMap[sub.parent_id] || null;
            insertCat.run(sub.key, sub.name, sub.icon, newParentId);
        }

        for (const p of data.products) {
            const features = typeof p.features === 'string' ? p.features : JSON.stringify(p.features || []);
            insertProd.run(p.name, p.main_category_key, p.sub_category_key, p.price, p.type || 'standard',
                p.description || '', p.icon || 'fa-box', features, p.image || '', p.stock || 0, p.stock_min || 5);
        }
    });

    importAll();
    console.log(`Imported ${data.categories.length} categories, ${data.products.length} products`);
}

module.exports = { getDb, initDatabase };
