const express = require('express');
const { getDb } = require('../database');
const router = express.Router();

function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    return require('stripe')(key);
}

router.post('/create-session', async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(500).json({ error: 'Stripe nuk është konfiguruar' });

    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id mungon' });

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order) return res.status(404).json({ error: 'Porosia nuk u gjet' });

    const items = JSON.parse(order.items || '[]');
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    try {
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'eur',
                product_data: { name: item.name },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));

        if (order.shipping > 0) {
            lineItems.push({
                price_data: {
                    currency: 'eur',
                    product_data: { name: 'Dërgesa' },
                    unit_amount: Math.round(order.shipping * 100),
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${baseUrl}/payment-success.html?order=${order.order_number}`,
            cancel_url: `${baseUrl}/payment-cancel.html?order=${order.order_number}`,
            metadata: { order_id: order.id.toString(), order_number: order.order_number },
            customer_email: order.customer_email,
        });

        db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, order.id);
        res.json({ url: session.url });
    } catch (e) {
        console.error('Stripe session error:', e.message);
        res.status(500).json({ error: 'Gabim gjatë krijimit të sesionit Stripe' });
    }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(500).send('Stripe not configured');

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            event = JSON.parse(req.body);
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata?.order_id;

        if (orderId) {
            const db = getDb();
            db.prepare("UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(parseInt(orderId));
            console.log(`[Stripe] Payment confirmed for order #${session.metadata.order_number}`);
        }
    }

    res.json({ received: true });
});

module.exports = router;
