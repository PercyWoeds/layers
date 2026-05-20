const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

module.exports = async function handler(req, res) {
  // 1. Configurar cabeceras CORS idénticas para evitar bloqueos del navegador
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permite peticiones desde tu Shopify
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Manejo de Preflight (OPTIONS) - CRÍTICO para que el navegador apruebe el cruce de dominios
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { carrito, shopifyDomain } = req.body;

    if (!carrito || !carrito.items) {
      return res.status(400).json({ error: 'Datos insuficientes' });
    }

    const domain = shopifyDomain || 'layers.pe';

    const items = carrito.items.map(item => ({
      id: String(item.variant_id || item.id),
      title: item.title,
      quantity: parseInt(item.quantity),
      unit_price: Number(item.price / 100),
      currency_id: 'PEN',
      picture_url: item.image || ''
    }));

    const preferenceData = {
      items: items,
      payment_methods: {
        installments: 12
      },
      back_urls: {
        success: `https://${domain}/pages/pago-exitoso`,
        failure: `https://${domain}/pages/pago-fallido`,
        pending: `https://${domain}/pages/pago-pendiente`
      },
      auto_return: 'approved',
      external_reference: `shopify-${carrito.token}`,
      // 🔑 HILO CONDUCTOR 2: La URL de tu nuevo archivo webhook en Vercel
      notification_url: `https://layers-alpha-eight.vercel.app/api/webhook`

    };

    const preference = new Preference(client);
    const resultado = await preference.create({ body: preferenceData });

    return res.status(200).json({
      id: resultado.id,
      init_point: resultado.init_point, // Habilita el link real para producción
      //sandbox_init_point: resultado.sandbox_init_point 
    });

  } catch (error) {
    console.error('[MP Error]:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
};