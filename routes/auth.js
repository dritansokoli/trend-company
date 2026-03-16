const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('../database');
const { createLoginRateLimiter } = require('../middleware/loginRateLimit');
const { logSecurityEvent } = require('../middleware/securityAudit');
const router = express.Router();

const adminLoginLimiter = createLoginRateLimiter({
    prefix: 'admin-login',
    identityField: 'username',
    windowMs: process.env.ADMIN_LOGIN_WINDOW_MS,
    maxAttempts: process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 5,
    blockMs: process.env.ADMIN_LOGIN_BLOCK_MS,
    baseDelayMs: process.env.ADMIN_LOGIN_BASE_DELAY_MS || 400,
    maxDelayMs: process.env.ADMIN_LOGIN_MAX_DELAY_MS || 4000
});

function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

function requireAdminCsrf(req, res, next) {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
    if (!req.session?.userId) return next();

    const token = req.get('x-csrf-token');
    if (!token || token !== req.session.csrfToken) {
        return res.status(403).json({ error: 'CSRF token i pavlefshëm' });
    }
    next();
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStrongPassword(password) {
    if (typeof password !== 'string' || password.length < 12) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    return hasUpper && hasLower && hasDigit && hasSymbol;
}

router.post('/login', adminLoginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Plotëso të gjitha fushat' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        const guard = req.loginGuard;
        const delayMs = guard?.getFailureDelayMs ? guard.getFailureDelayMs() : 400;
        const state = guard?.registerFailure ? await guard.registerFailure() : null;

        logSecurityEvent(req, {
            actorType: 'admin',
            actorName: username,
            eventType: 'admin_login_failed',
            severity: 'warn',
            details: {
                username,
                failures: state?.failures || 1,
                blocked: Boolean(state?.blockedUntil && state.blockedUntil > Date.now())
            }
        });

        await wait(delayMs);
        if (state?.blockedUntil && state.blockedUntil > Date.now()) {
            const retryAfterSeconds = Math.ceil((state.blockedUntil - Date.now()) / 1000);
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({ error: 'Shume tentativa hyrjeje. Provo serish pas pak minutash.' });
        }

        return res.status(401).json({ error: 'Përdoruesi ose fjalëkalimi nuk është i saktë' });
    }

    req.loginGuard?.registerSuccess?.();

    // Regenerate session after authentication to prevent session fixation.
    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Gabim ne server' });
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.csrfToken = generateCsrfToken();
        req.session.save((saveErr) => {
            if (saveErr) return res.status(500).json({ error: 'Gabim ne server' });
            logSecurityEvent(req, {
                actorType: 'admin',
                actorId: user.id,
                actorName: user.username,
                eventType: 'admin_login_success',
                severity: 'info'
            });
            res.json({ success: true, username: user.username });
        });
    });
});

router.post('/logout', requireAdminCsrf, (req, res) => {
    const actorId = req.session?.userId || null;
    const actorName = req.session?.username || null;
    if (!req.session) return res.json({ success: true });

    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Gabim ne server' });
        logSecurityEvent(req, {
            actorType: 'admin',
            actorId,
            actorName,
            eventType: 'admin_logout',
            severity: 'info'
        });
        res.clearCookie(req.app.locals.sessionCookieName || 'trend.sid');
        res.json({ success: true });
    });
});

router.get('/check', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ loggedIn: true, username: req.session.username });
    } else {
        res.json({ loggedIn: false });
    }
});

router.get('/csrf-token', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Nuk jeni i kyçur' });
    if (!req.session.csrfToken) req.session.csrfToken = generateCsrfToken();
    res.json({ csrfToken: req.session.csrfToken });
});

router.post('/change-password', requireAdminCsrf, (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Nuk jeni i kyçur' });
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Plotëso fushat' });
    if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ error: 'Fjalekalimi i ri duhet te kete te pakten 12 karaktere dhe te perfshije shkronje te medha/vogla, numer dhe simbol' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
        return res.status(400).json({ error: 'Fjalëkalimi aktual nuk është i saktë' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    logSecurityEvent(req, {
        actorType: 'admin',
        actorId: user.id,
        actorName: user.username,
        eventType: 'admin_password_changed',
        severity: 'warn'
    });
    res.json({ success: true });
});

module.exports = router;
