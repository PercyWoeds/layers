// ============================================================
// ARCHIVO: api/carrito.js
// Obtiene el carrito de Shopify usando la URL pública del carrito.
// No requiere autenticación ni tokens — Shopify lo permite
// para carritos activos.
//
// VARIABLES DE ENTORNO REQUERIDAS EN VERCEL:
//   SHOPIFY_DOMAIN = layers.myshopify.com  (o tu dominio custom)
// ============================================================

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;

module.exports = async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Método no permitido' });

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token de carrito requerido' });
  }

  try {
    // Shopify expone los carritos públicamente por token
    // Funciona con el dominio myshopify o el dominio personalizado
    const url = `https://${SHOPIFY_DOMAIN}/cart/${token}.js`;

    const shopifyRes = await fetch(url, {
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'CheckoutCuotasMP/1.0'
      }
    });

    if (shopifyRes.status === 404) {
      return res.status(404).json({
        error: 'Carrito no encontrado o expirado. Por favor volvé a la tienda.'
      });
    }

    if (!shopifyRes.ok) {
      throw new Error(`Shopify respondió con status ${shopifyRes.status}`);
    }

    const carrito = await shopifyRes.json();

    if (!carrito.items || carrito.items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }

    // Normalizar items para el frontend
    const items = carrito.items.map(item => ({
      title:    item.product_title + (item.variant_title && item.variant_title !== 'Default Title' ? ' — ' + item.variant_title : ''),
      quantity: item.quantity,
      price:    item.price,           // ya viene en centavos desde Shopify
      image:    item.image || ''
    }));

    // El total también viene en centavos
    const totalCentavos = carrito.items_subtotal_price;
    const totalSoles    = totalCentavos / 100;

    return res.status(200).json({
      items,
      token,
      total:        totalSoles,
      currencyCode: 'PEN'
    });

  } catch (error) {
    console.error('[Carrito] Error:', error.message);
    return res.status(500).json({
      error:   'Error al obtener el carrito',
      detalle: error.message
    });
  }
};