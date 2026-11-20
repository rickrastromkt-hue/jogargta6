# Ligar o Pix do Mercado Pago

O código já está pronto. Faltam três coisas do seu lado: a credencial, o
webhook e o deploy. Nada disso passa por mim nem fica no arquivo do site.

---

## 1. Pegue o Access Token

Mercado Pago → **Seus negócios → Configurações → Gestão e administração →
Credenciais**.

Existem dois pares:

| | Quando usar | Prefixo |
|---|---|---|
| **Credenciais de teste** | enquanto você testa | `TEST-...` |
| **Credenciais de produção** | quando for cobrar de verdade | `APP_USR-...` |

Você precisa do **Access Token**, não da Public Key. O Access Token é senha:
quem tiver ele movimenta sua conta. Nunca cole em chat, print, commit ou no
HTML.

Comece pelo de teste. Só troque pelo de produção quando o fluxo estiver
redondo.

---

## 2. Configure na Vercel

Projeto → **Settings → Environment Variables**:

```
MP_ACCESS_TOKEN = APP_USR-xxxxxxxx...
```

Marque **Production**, **Preview** e **Development**. Depois de salvar,
faça um novo deploy — variável nova não entra em deploy antigo.

---

## 3. Configure o webhook

Mercado Pago → **Suas integrações → sua aplicação → Webhooks → Configurar
notificações**.

- URL: `https://jogargta6.com/api/pix/webhook`
- Evento: marque apenas **Pagamentos**

---

## 4. Teste

1. Com as credenciais de **teste**, abra o site e vá até o Pix.
2. O QR aparece e o copia e cola fica disponível.
3. Pague usando uma **conta de teste comprador** (Mercado Pago → Suas
   integrações → Contas de teste). Não use sua conta real com credencial
   de teste: não funciona.
4. Em até ~4 segundos a tela deve virar sozinha para os números da sorte.

Se der erro, a tela mostra o motivo que veio do Mercado Pago. O log completo
fica em **Vercel → Deployments → Functions**.

---

## Como funciona por dentro

```
navegador                  /api/pix/criar            Mercado Pago
   | POST nome,email,cpf -------->|
   |                              | POST /v1/payments (Bearer TOKEN) -->|
   |<-- copia-e-cola + QR base64 -|<-------------- qr_code, qr_code_base64
   |
   | GET /api/pix/status?id= (a cada 4s)
   |                              | GET /v1/payments/{id} ------------->|
   |<-- { pago: true } -----------|<-------------- status: approved
   |
   v  mostra os números da sorte
```

Em paralelo, o Mercado Pago chama `/api/pix/webhook` quando o status muda.

**Por que o navegador pergunta ao nosso servidor e não direto ao Mercado
Pago:** consultar a API deles exige o Access Token. Se o navegador tivesse o
token, qualquer visitante abriria o DevTools e teria acesso à sua conta.

**Por que não validamos a assinatura HMAC do webhook:** o Mercado Pago não
documenta publicamente como montar o manifest do HMAC — a página de
referência da API está fora do ar e as páginas de webhook só mostram código
de SDK. Em vez de adivinhar, o webhook ignora o conteúdo da notificação e
usa só o `id` para **consultar o pagamento na API** com o nosso token. Quem
responde é o Mercado Pago, então uma notificação forjada não engana nada.

---

## O que ainda falta para produção

**Persistir a compra.** Hoje, se a pessoa fechar a aba antes de o Pix cair,
o pagamento entra na sua conta mas o site não registra os números dela.
Para resolver, o webhook precisa gravar no Firestore com o **firebase-admin**
e uma conta de serviço:

1. Firebase → Configurações do projeto → Contas de serviço → Gerar nova
   chave privada (baixa um JSON).
2. Vercel → variável `FIREBASE_SERVICE_ACCOUNT` com o JSON inteiro.
3. `npm i firebase-admin` e destravar o trecho marcado com TODO em
   `api/pix/webhook.js`.

**Avisar no WhatsApp.** O campo é coletado e vai nos `metadata` do pagamento,
mas nada é enviado ainda. Precisa de uma API de WhatsApp (Cloud API da Meta,
Z-API, Twilio) chamada pelo webhook depois do `approved`.

**Sorteio no servidor.** Os números da sorte são gerados no navegador. Para
valer como sorteio, precisam nascer no servidor, ligados ao `external_reference`
do pagamento, e ficar registrados antes do resultado.

**A questão da autorização.** Continua valendo o que está na seção 7 do
`MONTAGEM.md`: cobrar por chance sorteada é atividade regulada. Ligar o
gateway torna a cobrança real — e a exposição também.
