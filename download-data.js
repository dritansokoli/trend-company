require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'database.sqlite');
const RENDER_URL = process.env.RENDER_URL || 'https://trend-company.onrender.com';
const SYNC_TOKEN = process.env.SYNC_TOKEN;

if (!SYNC_TOKEN) {
    console.log('GABIM: SYNC_TOKEN nuk eshte vendosur ne .env');
    process.exit(1);
}

async function download() {
    console.log('============================================');
    console.log('  TREND COMPANY - Shkarkim nga Interneti');
    console.log('============================================');
    console.log(`\nDuke shkarkuar nga: ${RENDER_URL}`);

    let data;
    try {
        const res = await fetch(`${RENDER_URL}/api/export?token=${SYNC_TOKEN}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        data = await res.json();
    } catch (e) {
        console.log(`\nGABIM: Nuk mund te lidhet me serverin online!`);
        console.log(`Detaje: ${e.message}`);
        console.log('\nKontrollo:');
        console.log('  - A eshte aktiv serveri ne Render.com?');
        console.log('  - A eshte i sakte RENDER_URL ne .env?');
        console.log('  - A eshte i njejte SYNC_TOKEN ne te dyja anet?');
        process.exit(1);
    }

    console.log(`\nTe dhena te marra nga serveri (${data.exported_at}):`);
    console.log(`  Kategori: ${data.categories.length}`);
    console.log(`  Produkte: ${data.products.length}`);
    console.log(`  Kliente:  ${data.customers.length}`);

    if (!fs.existsSync(DB_PATH)) {
        console.log('\nGABIM: Databaza lokale nuk ekziston! Nis serverin lokal njehere para.');
        process.exit(1);
    }

    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = OFF');

    const stats = { newCustomers: 0, updatedCustomers: 0 };

    const syncCustomers = db.transaction(() => {
        for (const c of data.customers) {
            const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(c.email);
            if (existing) {
                db.prepare(
                    'UPDATE customers SET first_name=?, last_name=?, phone=?, country=?, city=?, address=? WHERE email=?'
                ).run(c.first_name, c.last_name, c.phone, c.country, c.city, c.address, c.email);
                stats.updatedCustomers++;
            } else {
                db.prepare(
                    'INSERT INTO customers (first_name, last_name, email, password_hash, phone, country, city, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).run(c.first_name, c.last_name, c.email, '---synced---', c.phone || '', c.country || 'XK', c.city || '', c.address || '', c.created_at);
                stats.newCustomers++;
            }
        }
    });

    syncCustomers();

    console.log('\n=== Rezultati i Sinkronizimit ===');
    console.log(`  Kliente te rinj:         ${stats.newCustomers}`);
    console.log(`  Kliente te perditesuar:   ${stats.updatedCustomers}`);
    console.log('\nSinkronizimi u krye me sukses!');

    db.close();
}

download();
