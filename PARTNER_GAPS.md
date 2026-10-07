# White-label (Groover): o que falta na Public API para parceiros

Investigação feita a partir do protótipo que usa **só a Public API**, com uma única API key de org. Escopo: wallet, cobrança, renovação, eventos e o mapeamento dos usuários do parceiro.

## TL;DR

- **Bloqueante:** toda campanha wallet criada pela Public API nasce com **auto-renew ligado**, e o parceiro não tem como desligar. Por isso o gasto não tem teto: ao fim de cada ciclo o backend debita outro ciclo do wallet da org.
- **Falta endpoint de saldo.** O parceiro só descobre que o saldo acabou quando recebe um `402 insufficient_credit` ao criar campanha.
- **Cobrança no cartão ao criar campanha:** hoje não existe, nem na UI do produto. **Não recomendo** fazer isso para white-label: quem cobra o artista é o parceiro, e a Soundlink fatura o parceiro (B2B).
- O wallet interno já está maduro (ledger, reservas, auto-recharge, cartões). O que falta é **expor isso na Public API**, não construir do zero.

## O que já existe na Public API

| Capacidade            | Detalhe                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Criar campanha wallet | Reserva `dailyBudget × durationDays` adiantado. Saldo insuficiente → `402 insufficient_credit` com `details: { available, required }` |
| Aumentar budget       | Debita do wallet e devolve `walletBalance` (único lugar onde o saldo aparece na API)                                                  |
| Diminuir budget       | Reembolso assíncrono para o wallet (mínimo $10/dia, mais de 3 dias restantes)                                                         |
| Stop                  | Reembolsa o que não foi gasto para o wallet. É terminal: não há restart                                                               |
| Métricas              | `spend_media`, `spend_total`, `fees`, CPL/CPF, breakdown e export diário                                                              |
| Idempotency           | Obrigatório em create/stop/budget; TTL 24h; `409` se o mesmo key vier com body diferente                                              |
| Rate limit            | 60/min e 600/hora por key; import de vídeo 20/hora                                                                                    |

## Gaps

### P0: antes de liberar para o parceiro

1. **Controle de auto-renew**
   - Hoje: `campaigns.repository.ts` grava `auto_renew_enabled: true` para toda campanha wallet. O toggle existe (`PUT /api/v1/campaigns/:id/wallet/auto-renew`), mas só com token Firebase.
   - Impacto: o limite de gasto por usuário do parceiro (ex.: $10/dia × 7 dias = $70) não vale. A renovação pode ainda sair **mais cara** que a criação, porque inclui as Ad fees.
   - Proposta: campo `autoRenew: boolean` no `POST /v1/campaigns` (default `false` para parceiro, ou configurável por org) e/ou `PUT /v1/campaigns/{id}/auto-renew`.

2. **Enum `CampaignStatus` desatualizado no OpenAPI**
   - O OpenAPI documenta `creating|active|paused|stopped|completed|failed|ended`, mas o backend devolve o status interno como vem, incluindo `renewing`, `renew_failed` e `inactive`.
   - Proposta: documentar o enum real e o ciclo de vida (quais status são terminais, quais permitem stop).

3. **`GET /v1/wallet`**
   - Hoje: não existe. O endpoint interno `GET /organizations/:id/credits` devolve só `{ balance, updatedAt }`, sem descontar as reservas ativas, então expor ele como está daria um número enganoso.
   - Proposta: `{ balance, available, reserved, currency: "USD", updatedAt }`, com scope `wallet:read`. Dá para reaproveitar `CreditService.getAvailableBalance` (o agent já faz isso em `WalletToolsService.getWalletBalance`).

4. **Gate `wallet_not_enabled`**
   - `PublicApiWalletNotEnabledError` está definido e documentado, mas **nunca é lançado**. Uma org sem wallet habilitado não é bloqueada no create.

### P1: para operar em escala

5. **Referência externa no create**
   - Hoje: só existe `campaignName`, que vira nome do smartlink e **não volta** no `GET /v1/campaigns`. O parceiro precisa manter a própria tabela de mapeamento `campaignId → usuário`.
   - Proposta: `externalReference` (string) ou `metadata` (objeto pequeno), devolvido no GET e filtrável.

6. **Filtros na listagem**
   - Hoje `GET /v1/campaigns` aceita só `page`, `pageSize`, `sortBy` e `sortOrder`.
   - Proposta: filtrar por `status`, `externalReference` e data de criação.

7. **Webhooks**
   - Hoje: não existe nenhum. Saldo baixo e falha de renovação geram **email** para o primary user da org; o parceiro só fica sabendo via polling (dentro do limite de 60 req/min).
   - Eventos mínimos: `campaign.status_changed`, `campaign.renew_failed`, `wallet.low_balance`, `wallet.topup_credited`.

8. **Histórico do wallet** (`GET /v1/wallet/transactions`)
   - Para o parceiro conciliar o que cobrou dos artistas com o que a Soundlink debitou. Dá para reaproveitar `listOrgLedger`, desde que o `debug_payload` não seja exposto.

### P2

9. Recibos e faturas via API (hoje só pela rota interna `.../credits/topups/:id/invoice`).
10. Auto-recharge por threshold e top-up via API com o cartão corporativo do parceiro (ver a seção abaixo).
11. Reiniciar uma campanha `stopped` (hoje a saída é criar outra).
12. Isolamento de saldo por sub-conta. Hoje todos os usuários do parceiro dividem o mesmo wallet da org, e o limite por usuário fica do lado do parceiro.

## Cobrança no cartão ao criar campanha

**Como funciona hoje:**

- Nenhum caminho cobra cartão na criação, nem na UI. Na UI o botão de criar fica desabilitado até o wallet cobrir o ciclo, e o usuário faz o top-up antes (Stripe Checkout ou cartão salvo, mínimo $50).
- O auto-recharge existe por org (cartão Primary + teto mensal), mas **só dispara na renovação** e cobra só a diferença que falta. Os campos `threshold_amount` e `recharge_amount` são salvos, mas não são usados na cobrança.
- Não existe job do tipo "saldo abaixo de X, recarrega".

**Recomendação para white-label:**

- **V0:** fatura + top-up feito pelo CSM (admin-topup), como já decidido.
- **Fase 2:** auto-recharge por threshold com o cartão corporativo do parceiro (ex.: "se `available` < $500, recarrega $2.000"). Exige que o `threshold_amount` passe a funcionar de verdade e o trigger seja estendido para além da renovação. A cobrança off-session de `wallet-auto-recharge.writer.ts` pode ser reaproveitada.
- **Não fazer:** cobrar o cartão do artista final pela Soundlink. Isso mistura a cobrança do usuário final com o funding da org e traz chargeback, fraude, reembolso e PCI para dentro da Soundlink.

## Riscos para o V0 do Groover se nada mudar

- Campanhas renovam sozinhas e debitam ciclos que o parceiro não previu.
- `renew_failed` acontece em silêncio para o parceiro (o email vai para a org).
- O wallet é compartilhado: um artista pode consumir o saldo dos outros.
- Sem saldo visível, o parceiro só descobre que o saldo acabou quando o create falha com 402.
