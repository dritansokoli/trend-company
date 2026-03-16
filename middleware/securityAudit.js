const { getDb } = require('../database');

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown-ip';
}

function sanitizeDetails(input) {
    if (!input || typeof input !== 'object') return {};
    const sensitiveKeys = ['password', 'oldPassword', 'newPassword', 'password_hash', 'csrfToken', 'token'];
    const safe = {};
    for (const [key, value] of Object.entries(input)) {
        if (sensitiveKeys.includes(key)) continue;
        if (typeof value === 'string' && value.length > 300) safe[key] = `${value.slice(0, 300)}...`;
        else safe[key] = value;
    }
    return safe;
}

function logSecurityEvent(req, options = {}) {
    const {
        actorType = 'system',
        actorId = null,
        actorName = null,
        eventType = 'unknown_event',
        severity = 'info',
        details = {}
    } = options;

    try {
        const db = getDb();
        db.prepare(`
            INSERT INTO security_audit_logs (
                actor_type, actor_id, actor_name, event_type, severity, ip, user_agent, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            actorType,
            actorId,
            actorName,
            eventType,
            severity,
            getClientIp(req),
            req.get('user-agent') || '',
            JSON.stringify(sanitizeDetails(details))
        );
    } catch (err) {
        console.error('Security audit logging failed:', err.message);
    }
}

module.exports = { logSecurityEvent, getClientIp };
