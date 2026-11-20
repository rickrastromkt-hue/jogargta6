# Arena Play — o que é preciso para o sistema real

## 1. O problema central: latência

Esse é o item que mata o projeto se for ignorado. Transmissão normal de
Kick/Twitch/YouTube é **HLS, com 2 a 6 segundos de atraso**. Com 3s de delay
ninguém joga nada — você aperta, vê o resultado 3 segundos depois.

A solução é ter **dois caminhos de vídeo ao mesmo tempo**:

| Caminho | Para quem | Tecnologia | Latência |
|---|---|---|---|
| Baixa latência | só quem está no controle | WebRTC (WHIP/WHEP) | 150–400 ms |
| Transmissão | audiência (milhares) | HLS no Kick/YouTube | 2–6 s |

Para o WebRTC: **MediaMTX** (grátis, self-hosted), **LiveKit Cloud** ou
**Cloudflare Stream WebRTC**. O OBS 30+ já publica em WHIP nativamente.

## 2. Captura de vídeo

- **Elgato HD60 X** (1080p60) — ~R$ 900, suficiente
- **Elgato 4K X** se quiser 4K60 — ~R$ 2.000
- Entra: HDMI do console → sai: USB-C para o PC
- PS5: desligar HDCP em *Ajustes → Sistema → HDMI → Desativar HDCP*
  (sem isso a captura fica tela preta)

## 3. Injetar o comando no PlayStation — 3 caminhos

O console não aceita input por rede. Opções, da mais fácil para a mais difícil:

### Caminho A — Remote Play num PC (recomendado para começar)
PS5 → **PS Remote Play** ou **Chiaki** rodando num PC → o PC recebe os comandos
pela internet e injeta um **controle virtual**.

- Windows: `ViGEmBus` + biblioteca `vgamepad` (Python)
- O PC vira um DualSense virtual; o Remote Play manda pro console
- **Custo: R$ 0 de hardware.** Só precisa do PC.
- Latência extra: ~80–150 ms em rede local
- Limitação: Remote Play às vezes derruba sessão longa; precisa de watchdog

### Caminho B — Microcontrolador emulando controle USB
Teensy 4.0 ou Arduino Pro Micro emulando HID, plugado na USB do console.

- **O PS5 não aceita HID genérico** — exige autenticação de controle licenciado
- Precisa de adaptador licenciado no meio: **Brook Wingman FGC** ou **Titan Two**
- Titan Two tem API por USB e aceita script — é o caminho profissional
- Custo: ~R$ 700–1.200 no adaptador + ~R$ 300 no microcontrolador
- Vantagem: não depende de Remote Play, muito mais estável

### Caminho C — PC em vez de console
Se o jogo existir em PC, some o problema inteiro: injeta input direto no
Windows, captura por OBS local, sem capture card e sem adaptador.

## 4. Arquitetura com Vercel + GitHub + Firebase

```
  navegador  ──WebSocket──►  autoridade de turno  ──WS──►  PC ao lado do console
 (Next.js/Vercel)            (Cloud Run / VPS)              (injeta no gamepad)
      │                            │
      └──── Firestore ◄────────────┘
         (fila, bilhetes, saldo)
```

**Atenção — armadilha do Vercel:** funções serverless são *stateless* e morrem
em segundos. **O relógio do turno e a fila não podem viver lá.** Você precisa de
um processo que fica de pé:

- **Cloud Run** (Google, combina com o Firebase) ou uma VPS de R$ 30/mês
- Ou **Firebase Realtime Database** + Cloud Functions agendadas

Divisão de responsabilidades:

| Peça | Onde | Papel |
|---|---|---|
| Site | Vercel (Next.js) | UI, SSR, nada de estado |
| Login | Firebase Auth | conta do jogador |
| Fila e bilhetes | Firestore | listeners em tempo real atualizam a UI sozinhos |
| Relógio do turno | Cloud Run / VPS | **única fonte da verdade** de quem está no controle |
| Relay de input | processo no PC do console | abre WS de saída, não precisa de IP público |
| Pagamento | Mercado Pago / Asaas / Pagar.me | Pix com webhook de confirmação |

## 5. Regras de segurança (não são opcionais)

- O servidor decide quem está no controle. **Nunca confie no cliente.**
- Só o socket do jogador ativo tem input aceito; todos os outros são descartados
  no servidor, não escondendo o botão na tela.
- Limite de taxa por socket (ex.: 60 eventos/s) — senão um script trava o relay.
- Lista fechada de botões permitidos. Bloqueie PS/Home/Share, senão o jogador
  sai do jogo, abre a loja ou acessa a conta do console.
- Conta do console: use uma conta descartável, sem cartão salvo, sem e-mail
  principal, com controle parental limitando compras.

## 6. Custo mínimo para colocar de pé

| Item | Custo |
|---|---|
| Capture card HD60 X | ~R$ 900 |
| PC para captura/Remote Play | já tem? R$ 0 |
| VPS para autoridade de turno | ~R$ 30/mês |
| Vercel + Firebase (início) | R$ 0 (free tier) |
| Internet upload ≥ 15 Mbps estável | — |
| **Total de entrada** | **~R$ 900 + R$ 30/mês** |

Caminho A + jogo de PC = **R$ 0 de hardware** para validar a ideia antes de
gastar qualquer coisa.

## 7. Dois riscos a resolver antes de cobrar

1. **Sorteio pago é loteria.** Entrada paga em sorteio é atividade regulada no
   Brasil (monopólio federal; Lei 5.768/71 exige que sorteio promocional seja
   gratuito; Lei 14.790/2023 exige licença federal para aposta). Vender **tempo
   garantido** (slot agendado de 15 ou 20 min) é venda de serviço e não cai
   nessa regra. Mesma receita, sem a exposição.
2. **Direito autoral.** Transmitir e cobrar acesso a um jogo comercial sem
   licença é convite a DMCA — e aí cai o canal e os passes já vendidos junto.
   Vale conversar com um advogado antes de ligar o gateway de pagamento.

---

# 8. O que a API pública da SmartCast revela

O jogargta.com é só a vitrine. O motor é a **SmartCast**, e o estado fica num
endpoint tRPC **aberto, sem autenticação e com CORS liberado para qualquer
origem** (`Access-Control-Allow-Origin: *`):

```
GET https://api.smartcast.gg/trpc/remotePlay.publicState?input={"json":{"workspaceId":"..."}}
```

O `workspaceId` sai do `/api/public/jogargta/live-status` do próprio site.
A demo consome isso direto do navegador, sem proxy, a cada 4 s.

## Configuração real de operação deles

Vem tudo no campo `config` — é o manual de regras do produto:

| Parâmetro | Valor | Significado |
|---|---|---|
| `sessionSeconds` | 600 | turno de 10 min |
| `claimSeconds` | 30 | 30 s para assumir, ou perde a vez |
| `queueHandoffSeconds` | 60 | janela de troca entre jogadores |
| `emptyQueueExtensionSeconds` | 300 | +5 min se a fila estiver vazia |
| `idleDisconnectSeconds` | 40 | 40 s parado = desconecta |
| `releaseOnDisconnect` | true | caiu, perdeu o turno |
| `priorityQueue.minAmountCents` | 500 | prioridade a partir de **R$ 5** |
| `priorityQueue.maxAmountCents` | 1000000 | teto de **R$ 10.000** num lance |
| `maxQueueSize` | 50 | limite por lane |
| `allowPauseMenu` | **false** | menu do sistema bloqueado |
| `allowMap` | true | mapa liberado |
| `voiceRoomEnabled` | true | sala de voz ativa |
| `pointsEnabled` | false | sistema de pontos **pronto, desligado** |
| `communityVotingEnabled` | false | votação da comunidade **pronta, desligada** |
| `gatewayOrigin` | `gta.manifestacao.com` | **o gateway que injeta o input** |

Três leituras úteis:

1. **O lance é leilão, não preço fixo.** De R$ 5 a R$ 10.000 por turno. O site
   mostra "R$ 25 / R$ 50" como sugestão, mas a mecânica real é quem paga mais
   passa na frente.
2. **Pontos e votação já estão construídos e desligados.** É o roteiro de
   produto deles: fidelizar sem dinheiro e deixar a plateia votar extensão.
3. **O gateway de input tem domínio próprio.** Confirma a arquitetura da seção 4:
   o relay de comando é um serviço separado do site.

## Números ao vivo (conferidos)

`queueCount: ~1500`, `priority.count: ~18`, `deathsAll: 26`, `previewCount: 12`.
A fila exibida no site **confere com a API** — aquele número não é inflado.

## O que a demo espelha e o que não espelha

| Campo | Fonte |
|---|---|
| Quem está no controle | **ao vivo**, pseudonimizado |
| Cronômetro do turno | **ao vivo** (`expiresAt - serverNow`) |
| Tamanho da fila / prioritária | **ao vivo** |
| Mortes, nível, ausente | **ao vivo** |
| Host online | **ao vivo** |
| Audiência | simulada (não vem nesse endpoint) |
| **Resultado do sorteio** | **ao vivo** — ver abaixo |
| Bilhetes e checkout | simulados |

### O sorteio não é sorteado

A contagem do sorteio é a mesma do turno: `SORTEIO EM` espelha `TEMPO RESTANTE`.
Quando o turno fecha, o "vencedor" anunciado **não sai de um sorteio** — é o
jogador real que assumiu o console, detectado pela troca de `active.id` na API.

```
active.id muda  ->  runDraw(nome_do_novo_active, fromLive=true)
                     anuncia vencedor, encerra o sorteio, abre o próximo
```

Na prática o sorteio vira uma narração do handoff real: o nº 1 da fila assume
e aparece como vencedor. Se a API cair, volta a sortear de um bolo fictício
(`runDraw()` sem argumento), então a tela nunca trava.

Consequência que vale saber: com dados ao vivo o resultado é **determinístico**,
não aleatório. Quem define quem joga é a fila da SmartCast, não o seu sorteio.

### A fila não mostra nome nenhum

O widget da fila exibe **bilhete numerado e em ordem embaralhada** — `#8693`,
`#4900`, `#2879` — não pessoas. O número vem de um hash do `id`, então o mesmo
jogador mantém o mesmo bilhete entre atualizações; a ordem vem de um segundo
hash, estável o bastante para a lista não pular a cada poll e sem revelar a
posição real de ninguém.

Isso resolve de vez a questão de dado pessoal na fila: não há nome para vazar.
O único ponto onde nome ainda aparece é **quem está no controle** e **o vencedor
anunciado**, e lá vale a regra de máscara abaixo.

### Sobre o nome de quem está jogando

A API devolve `name`, `profile.displayName` e `avatarUrl` — nome completo de
pessoas reais. A demo usa `LIVE.nameMode`, com três modos:

| Modo | Entrada | Saída |
|---|---|---|
| `masked` *(padrão)* | `Samuel Ferreira da Silva` | `Samuel S.` |
| | `MIBRxHALLS` | `MIBR···` |
| | `Bianca` | `Bianca` |
| `pseudo` | qualquer | `Jogador #A690` (hash estável do id) |
| `full` | `Samuel Ferreira da Silva` | `Samuel Ferreira da Silva` |

A regra do `masked` tem um detalhe que importa: quando o nome tem duas ou mais
palavras, vira primeiro nome + inicial. Quando é **uma palavra só**, aí não é
nome, é apelido — e apelido identifica tanto quanto nome completo, porque é
único e a pessoa usa ele em outros lugares. Por isso `MIBRxHALLS` é truncado
e não passa inteiro. Nome curto de uma palavra (`Bianca`, `Zé`) passa, porque
sozinho não leva a ninguém.

`<` e `>` são removidos antes de renderizar, senão um nome com HTML dentro
injeta marcação na sua página.

`masked` reduz muito a identificabilidade, mas não é anonimato: primeiro nome
somado a outros sinais ainda pode ser dado pessoal. É bem melhor que `full`,
e `full` é o único que claramente não tem base legal.

### Chat próprio no Firebase

O chat é seu, não o do Kick. Usa **Realtime Database por REST + EventSource**,
sem SDK e sem build — o RTDB transmite as mudanças em `text/event-stream`, então
o `EventSource` do navegador já recebe mensagem nova em tempo real.

Para ligar, preencha no topo do script:

```js
const CHAT = { dbUrl:'https://jogargta6-default-rtdb.firebaseio.com', path:'chat', ... };
```

Vazio = modo local: a mensagem aparece só na sua aba. A demo nunca quebra por
falta de Firebase.

**Regras do banco** (Realtime Database > Regras). Para testar:

```json
{ "rules": { "chat": { ".read": true, ".write": true } } }
```

Isso deixa **qualquer pessoa na internet escrever e apagar**. Serve para o
protótipo e só para ele. Antes de abrir ao público:

```json
{ "rules": { "chat": {
    ".read": true,
    ".write": "auth != null",
    "$msg": { ".validate": "newData.hasChildren(['n','m','t']) && newData.child('m').isString() && newData.child('m').val().length <= 160" }
} } }
```

...com Firebase Auth ligado (anônimo já resolve). Sem isso, um script enche seu
banco em minutos e a conta é sua.

O que já está no código: escape de `<`, `>` e `&` na renderização (testado com
`<b>xss</b>`, sai como texto), limite de 160 caracteres, 1 mensagem a cada
1,5 s por aba e teto de 300 mensagens em memória. Nada disso substitui a regra
no servidor — é só a primeira camada.

**Custo:** o RTDB cobra por download. Chat de texto é leve, mas com milhares de
espectadores conectados simultaneamente o tráfego cresce rápido; vale olhar o
free tier (1 GB/mês) antes de divulgar.

### Logo

O header usa `logo.png` na raiz, com um wordmark em CSS como reserva caso o
arquivo não esteja lá. Basta colocar o PNG ao lado do `index.html` que ele
assume sozinho — nenhuma mudança de código.

### Antes de depender disso em produção

Endpoint sem contrato pode ganhar token, rate limit ou mudar de nome sem aviso,
e aí sua home quebra. Para pitch e para estudar a mecânica, serve. Para produto
no ar, o caminho é a conversa com a SmartCast — a seção 7 explica por quê.


---

# 9. Fluxo de apoio (R$ 5) e Pix

Uma oferta só: **Apoie com R$ 5,00 e tenha a chance de jogar GTA VI** →
cadastro (nome + e-mail + aceite) → cobrança Pix.

## Por que o QR não pode ser estático

Um QR Pix fixo colado na página **não identifica quem pagou**. Se 200 pessoas
lerem o mesmo código, chegam 200 PIX de R$ 5 na conta e não há como ligar cada
um ao e-mail que se cadastrou — ou seja, não dá para sortear com honestidade
nem para provar quem tinha bilhete.

A cobrança precisa ser criada **uma por apoiador**, pelo provedor, com `txid`
próprio e **webhook** confirmando o pagamento. Só depois do webhook o bilhete
entra no sorteio.

```
cadastro -> POST /api/pix/criar -> PSP devolve { copiaecola, imagemQr, txid }
         -> usuário paga
         -> PSP chama seu webhook -> valida txid -> libera o bilhete
```

No código: preencha `PIX.criarCobranca` com o seu endpoint. Ele deve responder
`{ copiaecola, imagemQr, txid }`. Vazio = modo demonstração, sem cobrança.

Provedores com Pix e webhook: **Mercado Pago**, **Asaas**, **Pagar.me**,
**Efí (antiga Gerencianet)**. Todos exigem CNPJ e aprovação de cadastro.

## Nome e e-mail

`PIX.inscricoes` aponta para um nó do Realtime Database. Vazio = fica só na aba.

O formulário já tem aceite explícito marcável. Para valer como base legal da
LGPD, falta o que não é código: **uma página de política de privacidade de
verdade**, dizendo o que você guarda, por quanto tempo, com quem compartilha e
como a pessoa pede exclusão. E-mail de participante é dado pessoal — aqui você
é o controlador, não a SmartCast.

## O ponto que continua em aberto

Cobrar R$ 5 por **chance** sorteada é a questão da seção 7: sorteio com entrada
paga é atividade regulada e precisa de autorização. Vender **tempo garantido**
pelos mesmos R$ 5 — um slot agendado, mesmo que curto — é venda de serviço e
não cai nessa regra. O código muda pouco: o fluxo de cadastro e Pix é o mesmo,
o que muda é o que você entrega no fim.
