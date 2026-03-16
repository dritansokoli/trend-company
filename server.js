require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');

fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || 'development-only-secret-change-me';
const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'trend.sid';

initDatabase();

const stripeRoutes = require('./routes/stripe');
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (isProduction) app.set('trust proxy', 1);

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
}

app.locals.sessionCookieName = sessionCookieName;

app.use(session({
    name: sessionCookieName,
    proxy: isProduction,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000,
        sameSite: isProduction ? 'strict' : 'lax'
    }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const apiRoutes = require('./routes/api');
app.use('/api/auth', authRoutes);
app.use('/api/client', customerRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api', apiRoutes);

app.get('{*path}', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Route not found' });
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Gabim ne server' });
});

app.listen(PORT, () => {
    console.log(`TREND COMPANY server running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);

    if (process.env.NODE_ENV !== 'production') {
        const { startAutoSync } = require('./auto-sync');
        startAutoSync();
    }
});
