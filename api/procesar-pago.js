// ============================================================
// ARCHIVO: api/procesar-pago.js
// Recibe el token de tarjeta del frontend y ejecuta el pago
// en Mercado Pago. Solo permite 3, 6 o 12 cuotas.
// ============================================================

const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

// Cuotas permitidas — cualquier otro valor es rechazado por seguridad
const CUOTAS_PERMITIDAS = [3, 6, 12];

// URL de tu tienda Shopify (para redirigir al cliente al finalizar)
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', `https://${SHOPIFY_DOMAIN}`);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const {
      token,
      issuerId,
      paymentMethodId,
      transactionAmount,
      installments,
      description,
      cartToken,
      payer
    } = req.body;

    // ── Validaciones básicas ──────────────────────────────────

    if (!token || !transactionAmount || !installments || !payer?.email) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Bloquea cuotas no permitidas — esto es la clave de la solución
    // Aunque alguien modifique el frontend, el backend rechaza cualquier
    // valor que no sea 3, 6 o 12
    const cuotas = parseInt(installments);
    if (!CUOTAS_PERMITIDAS.includes(cuotas)) {
      return res.status(400).json({
        error: `Cuotas no permitidas. Solo se aceptan: ${CUOTAS_PERMITIDAS.join(', ')}`
      });
    }

    // ── Crear el pago en Mercado Pago ─────────────────────────

    const payment = new Payment(client);

    // SDK v2: los parámetros van directamente, sin wrapper { body: ... }
    const resultado = await payment.create({
      token:              token,
      issuer_id:          issuerId,
      payment_method_id:  paymentMethodId,
      transaction_amount: parseFloat(transactionAmount),
      installments:       cuotas,
      description:        description || 'Compra de alfombras',
      external_reference: `shopify-${cartToken}`,

      // Datos del comprador
      payer: {
        email: payer.email,
        identification: {
          type:   payer.identification?.type   || 'DNI',
          number: payer.identification?.number || ''
        }
      }
    });

    // ── Responder según estado del pago ───────────────────────

    const estado = resultado.status;

    if (estado === 'approved') {
      return res.status(200).json({
        status:      'approved',
        paymentId:   resultado.id,
        redirectUrl: `https://${SHOPIFY_DOMAIN}/pages/pago-exitoso?pid=${resultado.id}`
      });
    }

    if (estado === 'in_process' || estado === 'pending') {
      return res.status(200).json({
        status:    estado,
        paymentId: resultado.id,
        message:   'Tu pago está siendo procesado. Te avisaremos por email.'
      });
    }

    // Pago rechazado — devuelve el motivo para mostrarle al cliente
    const motivos = {
      cc_rejected_insufficient_amount: 'Fondos insuficientes en tu tarjeta.',
      cc_rejected_bad_filled_card_number: 'Número de tarjeta incorrecto.',
      cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta.',
      cc_rejected_bad_filled_security_code: 'CVV incorrecto.',
      cc_rejected_call_for_authorize: 'Tu banco requiere autorización. Llamá a tu banco.',
      cc_rejected_card_disabled: 'Tarjeta deshabilitada. Contactá tu banco.',
      cc_rejected_duplicated_payment: 'Pago duplicado detectado.',
    };

    const mensajeRechazo = motivos[resultado.status_detail]
      || 'El pago fue rechazado. Verificá los datos o intentá con otra tarjeta.';

    return res.status(200).json({
      status:  'rejected',
      message: mensajeRechazo,
      detail:  resultado.status_detail
    });

  } catch (error) {
    console.error('[Procesar Pago] Error:', error);
    return res.status(500).json({
      error:   'Error interno al procesar el pago',
      detalle: error.message
    });
  }
};
