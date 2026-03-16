const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { createLoginRateLimiter } = require('../middleware/loginRateLimit');
const { logSecurityEvent } = require('../middleware/securityAudit');
const router = express.Router();

const customerLoginLimiter = createLoginRateLimiter({
    prefix: 'customer-login',
    identityField: 'email',
    windowMs: process.env.CUSTOMER_LOGIN_WINDOW_MS,
    maxAttempts: process.env.CUSTOMER_LOGIN_MAX_ATTEMPTS || 8,
    blockMs: process.env.CUSTOMER_LOGIN_BLOCK_MS,
    baseDelayMs: process.env.CUSTOMER_LOGIN_BASE_DELAY_MS || 250,
    maxDelayMs: process.env.CUSTOMER_LOGIN_MAX_DELAY_MS || 2500
});

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

router.post('/register', (req, res) => {
    const { first_name, last_name, email, password, phone, country, city, address } = req.body;
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ error: 'Plotëso fushat e detyrueshme' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë së paku 6 karaktere' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Ky email ekziston tashmë' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO customers (first_name, last_name, email, password_hash, phone, country, city, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(first_name, last_name, email.toLowerCase(), hash, phone || '', country || 'XK', city || '', address || '');

    req.session.customerId = result.lastInsertRowid;
    req.session.customerName = first_name + ' ' + last_name;
    req.session.customerEmail = email.toLowerCase();

    res.json({ success: true, name: req.session.customerName, email: req.session.customerEmail });
});

router.post('/login', customerLoginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Plotëso fushat' });

    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email.toLowerCase());
    if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
        const guard = req.loginGuard;
        const delayMs = guard?.getFailureDelayMs ? guard.getFailureDelayMs() : 250;
        const state = guard?.registerFailure ? await guard.registerFailure() : null;

        logSecurityEvent(req, {
            actorType: 'customer',
            actorName: email.toLowerCase(),
            eventType: 'customer_login_failed',
            severity: 'info',
            details: { email: email.toLowerCase(), failures: state?.failures || 1 }
        });

        await wait(delayMs);
        if (state?.blockedUntil && state.blockedUntil > Date.now()) {
            const retryAfterSeconds = Math.ceil((state.blockedUntil - Date.now()) / 1000);
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({ error: 'Shume tentativa hyrjeje. Provo serish pas pak minutash.' });
        }
        return res.status(401).json({ error: 'Email ose fjalëkalimi nuk është i saktë' });
    }

    req.loginGuard?.registerSuccess?.();
    req.session.customerId = customer.id;
    req.session.customerName = customer.first_name + ' ' + customer.last_name;
    req.session.customerEmail = customer.email;

    logSecurityEvent(req, {
        actorType: 'customer',
        actorId: customer.id,
        actorName: customer.email,
        eventType: 'customer_login_success',
        severity: 'info'
    });

    res.json({ success: true, name: req.session.customerName, email: req.session.customerEmail });
});

router.post('/logout', (req, res) => {
    delete req.session.customerId;
    delete req.session.customerName;
    delete req.session.customerEmail;
    res.json({ success: true });
});

router.get('/check', (req, res) => {
    if (req.session?.customerId) {
        res.json({ loggedIn: true, name: req.session.customerName, email: req.session.customerEmail });
    } else {
        res.json({ loggedIn: false });
    }
});

module.exports = router;
