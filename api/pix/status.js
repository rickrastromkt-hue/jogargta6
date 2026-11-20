/* =====================================================================
   GET /api/pix/status?id=<id do pagamento>
   O navegador pergunta aqui se o Pix já caiu. Quem responde é a API do
   Mercado Pago, consultada com o token secreto — o navegador nunca o vê.
   ===================================================================== */

export default async function handler(req, res) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ erro: 'MP_ACCESS_TOKEN não configurado' });

  const id = String(req.query.id || '').replace(/\D/g, '');
  if (!id) return res.status(400).json({ erro: 'id ausente' });

  try {
    const r = await fetch('https://api.mercadopago.com/v1/payments/' + id, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!r.ok) return res.status(502).json({ erro: 'consulta recusada pelo Mercado Pago' });

    const d = await r.json();
    // o navegador só precisa saber se pagou; nada de dado sensível volta
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      status:  d.status,              // approved | pending | rejected | cancelled ...
      detalhe: d.status_detail,
      pago:    d.status === 'approved',
      txid:    d.external_reference || null
    });
  } catch (e) {
    console.error('falha ao consultar o MP:', e);
    return res.status(502).json({ erro: 'não foi possível consultar o pagamento' });
  }
}
