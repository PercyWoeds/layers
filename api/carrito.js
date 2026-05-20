// api/carrito.js
const axios = require('axios');

module.exports = async (req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token } = req.query;
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN || 'layers.myshopify.com';

  if (!token) {
    return res.status(400).json({ error: 'Falta el token del carrito.' });
  }

  try {
    // Consulta directa a la sesión del carrito público de Shopify
    const shopifyCartUrl = `https://${SHOPIFY_DOMAIN}/cart/${token}.js`;
    const response = await axios.get(shopifyCartUrl);
    
    const cartData = response.data;

    // Normalizar la respuesta para el Frontend (convertir centavos de Shopify a formato PEN decimal)
    const datosNormalizados = {
      token: cartData.token,
      total_price: cartData.total_price / 100,
      currency: 'PEN',
      items: cartData.items.map(item => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: item.price / 100,
        image: item.image
      }))
    };

    return res.status(200).json(datosNormalizados);
  } catch (error) {
    console.error('Error procesando carrito de Shopify:', error.message);
    return res.status(404).json({ 
      error: 'No se pudo recuperar el carrito. Asegúrate de que el token sea válido y esté activo.' 
    });
  }
};