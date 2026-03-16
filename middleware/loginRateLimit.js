const attempts = new Map();

function toInt(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function pruneExpired(now) {
    for (const [key, entry] of attempts.entries()) {
        const isWindowExpired = (now - entry.firstFailureAt) > entry.windowMs;
        if (entry.blockedUntil <= now && isWindowExpired) {
            attempts.delete(key);
        }
    }
}

function createLoginRateLimiter(config = {}) {
    const windowMs = toInt(config.windowMs, 10 * 60 * 1000);
    const maxAttempts = toInt(config.maxAttempts, 8);
    const blockMs = toInt(config.blockMs, 15 * 60 * 1000);
    const baseDelayMs = toInt(config.baseDelayMs, 300);
    const maxDelayMs = toInt(config.maxDelayMs, 3000);
    const prefix = config.prefix || 'login';
    const identityField = config.identityField || 'identity';

    return (req, res, next) => {
        const now = Date.now();
        pruneExpired(now);

        const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
        const rawIdentity = req.body?.[identityField];
        const identity = typeof rawIdentity === 'string' ? rawIdentity.trim().toLowerCase() : 'unknown-user';
        const key = `${prefix}:${ip}:${identity}`;
        const current = attempts.get(key) || { failures: 0, firstFailureAt: now, blockedUntil: 0, windowMs };

        if (current.blockedUntil > now) {
            const retryAfterSeconds = Math.ceil((current.blockedUntil - now) / 1000);
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({ error: 'Shume tentativa hyrjeje. Provo serish pas pak minutash.' });
        }

        if ((now - current.firstFailureAt) > windowMs) {
            current.failures = 0;
            current.firstFailureAt = now;
        }

        req.loginGuard = {
            key,
            failures: current.failures,
            async registerFailure() {
                const cur = attempts.get(key) || { failures: 0, firstFailureAt: Date.now(), blockedUntil: 0, windowMs };
                const failureNow = Date.now();
                if ((failureNow - cur.firstFailureAt) > windowMs) {
                    cur.failures = 0;
                    cur.firstFailureAt = failureNow;
                    cur.blockedUntil = 0;
                }

                cur.failures += 1;
                const overLimit = cur.failures >= maxAttempts;
                if (overLimit) {
                    cur.blockedUntil = failureNow + blockMs;
                }
                attempts.set(key, cur);
                return { failures: cur.failures, blockedUntil: cur.blockedUntil };
            },
            registerSuccess() {
                attempts.delete(key);
            },
            getFailureDelayMs() {
                const nextFailureCount = (attempts.get(key)?.failures || 0) + 1;
                const expDelay = baseDelayMs * (2 ** Math.max(0, nextFailureCount - 1));
                return Math.min(maxDelayMs, expDelay);
            }
        };

        attempts.set(key, current);
        next();
    };
}

module.exports = { createLoginRateLimiter };
