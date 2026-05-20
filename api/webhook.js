// api/webhook.js (Ejemplo de la lógica que falta)
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // 1. Mercado Pago te envía el ID del pago en el cuerpo de la petición
    const { data } = req.body;
    if (!data || !data.id) return res.status(200).end(); // Responder 200 siempre a MP

    // 2. Consultar el estado real del pago en Mercado Pago
    const payment = new Payment(client);
    const resultado = await payment.get({ id: data.id });

    // 3. Si el pago está aprobado, procedemos a registrarlo en Shopify
    if (resultado.status === 'approved') {
      const cartToken = resultado.external_reference; // Aquí viaja el 'shopify-token' que guardamos

      // 4. LLAMADA A LA API DE SHOPIFY PARA CREAR LA ORDEN
      const respuestaShopify = await fetch(`https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-04/orders.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN // Tu llave privada de Shopify
        },
        body: JSON.stringify({
          order: {
            line_items: resultado.additional_info.items.map(item => ({
              variant_id: parseInt(item.id),
              quantity: parseInt(item.quantity)
            })),
            financial_status: 'paid',
            email: resultado.payer.email,
            note: `Orden de Alfombra procesada en Vercel. MP ID: ${resultado.id}`
          }
        })
      });

      if (respuestaShopify.ok) {
        console.log('¡Orden creada con éxito en Shopify!');
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error en Webhook:', error);
    return res.status(500).end();
  }
};