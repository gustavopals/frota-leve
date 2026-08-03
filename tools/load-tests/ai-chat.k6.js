import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Load test do assistente de IA (TASK 3.9.6).
 *
 * 50 usuários simultâneos por 10 minutos. Valida ausência de 5xx e coleta a
 * latência do primeiro byte, que é o que o usuário percebe no streaming.
 *
 * Todos os VUs usam o mesmo tenant, então a carga satura o rate limiter de chat
 * (30 req/min por tenant) e a maior parte das respostas é 429 — comportamento
 * correto, não falha. Para medir vazão real de ponta a ponta, rode com um token
 * por tenant e o mesmo número de VUs distribuído entre eles.
 *
 * Uso:
 *   BASE_URL=https://api.exemplo.com TOKEN=<jwt> k6 run tools/load-tests/ai-chat.k6.js
 *
 * Rode contra staging com AI_MOCK=true para medir o harness sem gastar token,
 * e depois uma janela curta com a IA real para validar o custo projetado.
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

const serverErrors = new Rate('server_errors');
const throttled = new Rate('throttled_429');
const firstByte = new Trend('chat_first_byte_ms');

export const options = {
  scenarios: {
    chat: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || '10m',
    },
  },
  thresholds: {
    // Critério de aceite do ROADMAP: nenhum 5xx e p95 do primeiro byte < 2s.
    server_errors: ['rate==0'],
    chat_first_byte_ms: ['p(95)<2000'],
  },
};

const QUESTIONS = [
  'Qual veículo teve o maior custo por km no mês passado?',
  'Quantas multas tivemos nos últimos 30 dias?',
  'Quais manutenções estão pendentes?',
  'Qual o consumo médio da frota?',
  'Tem alguma anomalia aberta?',
];

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export function setup() {
  if (!TOKEN) {
    throw new Error('Defina TOKEN com um JWT válido antes de rodar o teste.');
  }

  const response = http.post(
    `${BASE_URL}/api/v1/ai/chat/sessions`,
    JSON.stringify({ title: 'Load test' }),
    { headers: headers() },
  );

  check(response, { 'sessão criada': (r) => r.status === 201 });

  return { sessionId: response.json('data.id') };
}

export default function (data) {
  const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

  const response = http.post(
    `${BASE_URL}/api/v1/ai/chat/sessions/${data.sessionId}/messages`,
    JSON.stringify({ content: question }),
    { headers: headers(), timeout: '60s' },
  );

  serverErrors.add(response.status >= 500);
  throttled.add(response.status === 429);
  firstByte.add(response.timings.waiting);

  check(response, {
    'sem erro de servidor': (r) => r.status < 500,
    // 429 é resposta correta: o rate limiter de chat permite 30 req/min por
    // tenant, e 50 VUs em um único tenant saturam isso de propósito. O que
    // importa é que a saturação vire throttling gracioso, não erro de servidor.
    'resposta esperada (200 ou 429)': (r) => r.status === 200 || r.status === 429,
  });

  // Ritmo realista: usuário lê a resposta antes de perguntar de novo.
  sleep(Math.random() * 5 + 3);
}

export function teardown(data) {
  if (data.sessionId) {
    http.del(`${BASE_URL}/api/v1/ai/chat/sessions/${data.sessionId}`, null, {
      headers: headers(),
    });
  }
}
