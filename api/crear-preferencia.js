// ============================================================
// ARCHIVO: api/crear-preferencia.js
// PLATAFORMA: Vercel (gratuito) — https://vercel.com
//
// INSTRUCCIONES DE DEPLOY EN VERCEL:
// 1. Crear cuenta en vercel.com (gratis)
// 2. Crear nuevo proyecto → "Deploy from GitHub" o subir carpeta
// 3. La estructura de carpetas debe ser:
//      mi-proyecto/
//        api/
//          crear-preferencia.js   ← este archivo
//        package.json             ← archivo 3
// 4. En Vercel → Settings → Environment Variables, agregar:
//      MP_ACCESS_TOKEN = TU_ACCESS_TOKEN_DE_PRODUCCION
//      SHOPIFY_DOMAIN  = tu-tienda.myshopify.com
// 5. Deploy → Vercel te da una URL como: https://mi-proyecto.vercel.app
// 6. Esa URL va en la variable URL_FUNCION del archivo 1 (script de Shopify)
// ============================================================
const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});
// Define el dominio aquí
  const shopifyDomain = 'layers.pe';
  
module.exports = async function handler(req, res) {
  // 1. Configurar cabeceras CORS para todas las respuestas
  res.setHeader('Access-Control-Allow-Origin', '*'); // En producción, mejor usa tu dominio de Shopify
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Manejo de Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { carrito, shopifyDomain } = req.body; // Asegúrate de enviar shopifyDomain desde el frontend

    if (!carrito || !carrito.items) {
      return res.status(400).json({ error: 'Datos insuficientes' });
    }

    // Si no recibes el dominio, usa uno por defecto o una variable
    const domain = shopifyDomain || 'layers.myshopify.com';

    const items = carrito.items.map(item => ({
      id: String(item.variant_id),
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
      // Importante: No mezcles "installments" fuera de payment_methods si usas la v2 del SDK
      back_urls: {
        success: `https://${domain}/pages/pago-exitoso`,
        failure: `https://${domain}/pages/pago-fallido`,
        pending: `https://${domain}/pages/pago-pendiente`
      },
      auto_return: 'approved',
      external_reference: `shopify-${carrito.token}`,
    };

    const preference = new Preference(client);
    const resultado = await preference.create({ body: preferenceData });

    return res.status(200).json({
      id: resultado.id,
     // init_point: resultado.init_point, // Link real
      sandbox_init_point: resultado.sandbox_init_point // Link de prueba
    });

  } catch (error) {
    console.error('[MP Error]:', error);
    // IMPORTANTE: El catch también debe responder con formato JSON para que el navegador no se pierda
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
};
