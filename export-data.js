const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');

if (!fs.existsSync(DB_PATH)) {
    console.log('GABIM: Databaza nuk ekziston! Nis serverin njehere para.');
    process.exit(1);
}

const db = new Database(DB_PATH);

const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
const products = db.prepare('SELECT * FROM products ORDER BY id').all();

const data = {
    exported_at: new Date().toISOString(),
    categories,
    products: products.map(p => ({
        ...p,
        features: JSON.parse(p.features || '[]')
    }))
};

const outPath = path.join(__dirname, 'data', 'seed-data.json');
fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`=== Eksportimi u krye me sukses! ===`);
console.log(`Kategori: ${categories.length}`);
console.log(`Produkte: ${products.length}`);
console.log(`Skedari: data/seed-data.json`);

db.close();
