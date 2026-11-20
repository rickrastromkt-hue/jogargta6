/* =====================================================================
   POST /api/pix/criar
   Cria uma cobrança Pix no Mercado Pago (Payments API) e devolve o
   copia-e-cola e o QR em base64.

   O ACCESS TOKEN é segredo e vive só aqui no servidor, nunca no navegador.
   Configure na Vercel:  Settings > Environment Variables
     MP_ACCESS_TOKEN = APP_USR-...   (produção)
   ===================================================================== */

const MP = 'https://api.mercadopago.com/v1/payments';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'use POST' });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ erro: 'MP_ACCESS_TOKEN não configurado' });

  const { centavos, item, nome, email, cpf, whatsapp } = req.body || {};

  // validações antes de gastar uma chamada na API
  const valor = Number(centavos);
  if (!Number.isInteger(valor) || valor < 100 || valor > 100000)
    return res.status(400).json({ erro: 'valor inválido' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))
    return res.status(400).json({ erro: 'e-mail inválido' });

  const doc = String(cpf || '').replace(/\D/g, '');
  if (doc && doc.length !== 11) return res.status(400).json({ erro: 'CPF inválido' });

  const partes = String(nome || '').trim().split(/\s+/);
  const ref = 'g6-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  const corpo = {
    transaction_amount: valor / 100,
    description: String(item || 'Entrada no sorteio').slice(0, 80),
    payment_method_id: 'pix',
    external_reference: ref,
    // 30 min é o mínimo aceito pelo MP; o padrão dele é 24 h
    date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    payer: {
      email,
      first_name: partes[0] || 'Jogador',
      last_name: partes.slice(1).join(' ') || 'Sorteio',
      ...(doc ? { identification: { type: 'CPF', number: doc } } : {})
    },
    metadata: { whatsapp: String(whatsapp || '').replace(/\D/g, '') }
  };

  try {
    const r = await fetch(MP, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        // o MP exige esta chave para não duplicar cobrança em caso de retry
        'X-Idempotency-Key': ref
      },
      body: JSON.stringify(corpo)
    });

    const d = await r.json();

    if (!r.ok) {
      console.error('MP recusou:', r.status, d);
      return res.status(502).json({
        erro: 'o Mercado Pago recusou a cobrança',
        detalhe: d.message || d.error || null,
        causa: Array.isArray(d.cause) ? d.cause.map(c => c.description || c.code) : null
      });
    }

    const tx = d.point_of_interaction?.transaction_data || {};
    if (!tx.qr_code) {
      console.error('resposta sem qr_code:', JSON.stringify(d).slice(0, 600));
      return res.status(502).json({ erro: 'o Mercado Pago não devolveu o código Pix' });
    }

    return res.status(200).json({
      id:         d.id,
      txid:       ref,
      status:     d.status,
      copiaecola: tx.qr_code,
      // o base64 vem sem prefixo; os bytes são PNG apesar de a doc citar jpeg
      imagemQr:   tx.qr_code_base64 ? 'data:image/png;base64,' + tx.qr_code_base64 : null,
      ticket:     tx.ticket_url || null,
      expiraEm:   d.date_of_expiration || null
    });

  } catch (e) {
    console.error('falha ao falar com o MP:', e);
    return res.status(502).json({ erro: 'não foi possível falar com o Mercado Pago' });
  }
}
