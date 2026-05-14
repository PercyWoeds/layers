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

// Cliente de Mercado Pago — usa la variable de entorno del servidor
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

module.exports = async function handler(req, res) {

  // Solo acepta POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Permite llamadas desde tu tienda Shopify (CORS)
  const shopifyDomain = process.env.SHOPIFY_DOMAIN || '';
  res.setHeader('Access-Control-Allow-Origin', `https://${shopifyDomain}`);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight de CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { carrito } = req.body;

    if (!carrito || !carrito.items || carrito.items.length === 0) {
      return res.status(400).json({ error: 'Carrito vacío o inválido' });
    }

    // Convierte los items del carrito de Shopify al formato de MP
    const items = carrito.items.map(function(item) {
      return {
        id:          String(item.variant_id),
        title:       item.title,
        quantity:    item.quantity,
        unit_price:  item.price / 100,   // Shopify usa centavos, MP usa pesos
        currency_id: 'PEN',              // Cambiá a 'PEN' si estás en Perú, etc.
        picture_url: item.image || ''
      };
    });

    // ============================================================
    // CONFIGURACIÓN DE CUOTAS
    // Aquí definís cuántas cuotas ofrecés para alfombras
    // ============================================================
    const preferenceData = {
      items: items,

      // Cuotas sin interés — el comprador puede elegir hasta 12 cuotas
      // Podés limitar con installments.default_installments
      // o con payment_methods.installments (número máximo)
     payment_methods: {
        installments: 12
      },
      installments: 3

      // URLs de retorno después del pago
      back_urls: {
        success: `https://${shopifyDomain}/pages/pago-exitoso`,
        failure: `https://${shopifyDomain}/pages/pago-fallido`,
        pending: `https://${shopifyDomain}/pages/pago-pendiente`
      },

      // MP redirige automáticamente después del pago exitoso
      auto_return: 'approved',

      // Referencia interna para identificar este pago en tu panel de MP
      external_reference: `shopify-${carrito.token}`,

      // Datos del comprador (si los tenés disponibles en el carrito, los pasás)
      // Mejora la aprobación de pagos
      // payer: {
      //   email: carrito.email || '',
      // }
    };

    // Crea la preferencia en Mercado Pago
    const preference = new Preference(client);
    const resultado = await preference.create({ body: preferenceData });

    // Devuelve el link de pago al script de Shopify
    // init_point = link de producción
    // sandbox_init_point = link de pruebas
    return res.status(200).json({
      id:                  resultado.id,
      sandbox_init_point:  resultado.sandbox_init_point
    });

  } catch (error) {
    console.error('[MP Preferencia] Error:', error);
    return res.status(500).json({
      error:   'Error al crear la preferencia de Mercado Pago',
      detalle: error.message
    });
  }
};
