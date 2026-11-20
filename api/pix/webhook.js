/* =====================================================================
   POST /api/pix/webhook
   URL para colar em: Mercado Pago > Suas integrações > Webhooks.
   Evento a marcar: "Pagamentos".

   A notificação do MP traz apenas um id. Não confiamos no corpo dela:
   buscamos o pagamento na API com o nosso token e acreditamos só na
   resposta da API. Isso dispensa validar o HMAC da assinatura, cujo
   formato do manifest o Mercado Pago não documenta publicamente.

   PERSISTÊNCIA: hoje este endpoint só registra no log. Para guardar a
   compra mesmo se a pessoa fechar a aba, grave em "pagamentos" no
   Firestore usando o firebase-admin com uma conta de serviço
   (env FIREBASE_SERVICE_ACCOUNT). Ver MONTAGEM.md.
   ===================================================================== */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) { console.error('MP_ACCESS_TOKEN não configurado'); return res.status(200).end(); }

  // o id pode vir no corpo ou na query, dependendo do tipo de notificação
  const corpo = req.body || {};
  const id = String(corpo?.data?.id || req.query['data.id'] || '').replace(/\D/g, '');
  const tipo = corpo.type || req.query.type;

  // responde rápido: o MP desiste depois de 22 s e começa a reenviar
  res.status(200).json({ ok: true });

  if (tipo !== 'payment' || !id) return;

  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments/' + id, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!r.ok) { console.error('webhook: MP recusou a consulta', r.status); return; }

    const d = await r.json();
    console.log('webhook pagamento', {
      id: d.id, status: d.status, ref: d.external_reference,
      valor: d.transaction_amount, email: d.payer?.email
    });

    if (d.status === 'approved') {
      // TODO: gravar no Firestore e disparar o aviso por e-mail
    }
  } catch (e) {
    console.error('webhook falhou:', e);
  }
}
