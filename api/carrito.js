module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { d } = req.query;

  if (!d) {
    return res.status(400).json({ error: 'Faltan parámetros del carrito' });
  }

  try {
    // Decodifica la información de manera segura
    const jsonString = Buffer.from(d, 'base64').toString('utf-8');
    const carrito = JSON.parse(jsonString);

    return res.status(200).json({
      items: carrito.items,
      token: carrito.token
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error al procesar los datos locales del carrito' });
  }
};