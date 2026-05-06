// Ship intelligence, not excuses.
export const DEFAULT_LOCAL_AI_BASE_URL = 'http://10.5.0.2:1234/v1';
export const DEFAULT_LOCAL_AI_MODEL = 'qwen3-coder-next';
export const DEFAULT_WEB_SEARCH_PROVIDER = 'brave';
export const DEFAULT_BRAVE_MCP_URL = 'http://10.5.0.2:8000/mcp';
export const DEFAULT_DDG_MCP_URL = 'http://10.5.0.2:8001/mcp';

export const MCP_INTEGRATION_KIND = Object.freeze({
  WEB: 'web',
  HUGGINGFACE: 'huggingface',
  OTHER: 'other',
});

export const DEFAULT_HUGGINGFACE_INTEGRATION = Object.freeze({
  type: 'ephemeral_mcp',
  server_label: 'huggingface',
  server_url: 'https://huggingface.co/mcp',
  allowed_tools: ['hub_repo_search', 'hub_repo_details', 'paper_search', 'hf_doc_search', 'hf_doc_fetch'],
});

export const DEFAULT_BRAVE_SEARCH_INTEGRATION = Object.freeze({
  type: 'ephemeral_mcp',
  server_label: 'brave-search',
  server_url: DEFAULT_BRAVE_MCP_URL,
  allowed_tools: ['brave_web_search', 'brave_local_search', 'brave_news_search'],
});

export const DEFAULT_DUCKDUCKGO_SEARCH_INTEGRATION = Object.freeze({
  type: 'ephemeral_mcp',
  server_label: 'ddg-search',
  server_url: DEFAULT_DDG_MCP_URL,
  allowed_tools: ['web_search', 'news_search'],
});

export function getDefaultEphemeralMcpIntegrations(provider = DEFAULT_WEB_SEARCH_PROVIDER) {
  const web = provider === 'duckduckgo' ? DEFAULT_DUCKDUCKGO_SEARCH_INTEGRATION : DEFAULT_BRAVE_SEARCH_INTEGRATION;
  return [cloneIntegration(web), cloneIntegration(DEFAULT_HUGGINGFACE_INTEGRATION)];
}

export function classifyMcpIntent(messagesOrText) {
  const text = extractIntentText(messagesOrText).toLowerCase();
  if (!text) return 'web';
  if (hasAny(text, HF_INTENT_PATTERNS)) return 'huggingface';
  if (hasAny(text, WEB_INTENT_PATTERNS)) return 'web';
  return 'web';
}

export function getIntegrationKind(integration) {
  const label = String(integration?.server_label ?? '').toLowerCase();
  const url = String(integration?.server_url ?? '').toLowerCase();
  const tools = Array.isArray(integration?.allowed_tools) ? integration.allowed_tools.map(t => String(t).toLowerCase()) : [];

  if (label.includes('huggingface') || label === 'hf' || url.includes('huggingface.co') || tools.some(tool => tool.startsWith('hf_') || tool.includes('hub_repo') || tool.includes('paper_search'))) {
    return MCP_INTEGRATION_KIND.HUGGINGFACE;
  }
  if (label.includes('brave') || label.includes('ddg') || label.includes('duckduckgo') || tools.some(tool => tool.includes('web_search') || tool.includes('news_search') || tool.includes('local_search'))) {
    return MCP_INTEGRATION_KIND.WEB;
  }
  return MCP_INTEGRATION_KIND.OTHER;
}

export function selectEphemeralMcpIntegrations(integrations, messagesOrText) {
  if (!Array.isArray(integrations) || integrations.length === 0) return [];
  const intent = classifyMcpIntent(messagesOrText);
  const preferredKind = intent === 'huggingface' ? MCP_INTEGRATION_KIND.HUGGINGFACE : MCP_INTEGRATION_KIND.WEB;
  const preferred = integrations.filter(integration => getIntegrationKind(integration) === preferredKind);
  if (preferred.length > 0) return preferred;
  if (preferredKind === MCP_INTEGRATION_KIND.WEB) return integrations.filter(integration => getIntegrationKind(integration) !== MCP_INTEGRATION_KIND.HUGGINGFACE);
  return integrations.filter(integration => getIntegrationKind(integration) !== MCP_INTEGRATION_KIND.HUGGINGFACE);
}

export function buildMcpRoutingInstruction(integrations, messagesOrText) {
  const selected = selectEphemeralMcpIntegrations(integrations, messagesOrText);
  const hasWeb = selected.some(integration => getIntegrationKind(integration) === MCP_INTEGRATION_KIND.WEB);
  const hasHf = selected.some(integration => getIntegrationKind(integration) === MCP_INTEGRATION_KIND.HUGGINGFACE);
  const lines = [
    'Vastaa selkeällä, luonnollisella suomen kielellä. Älä keksi tietoja. Jos et tiedä, sano ettet tiedä. Älä toista samoja lauseita. Älä käytä rikkinäisiä ilmauksia. Älä täytä vastausta turhalla jaarittelulla. Jos lähdettä ei ole, sano se suoraan.',
    'Älä sisällytä vastaukseen raw JSONia, tool_call-rakenteita, työkalulokeja tai sisäisiä MCP-jälkiä.',
    'Korkeintaan 2 MCP tool callia. Jos haku ei auta kahdella yrityksellä, anna lyhyt vastaus ja kerro rajoite.',
  ];

  if (hasWeb) {
    lines.push('General web search handles news, companies, sports, current events, websites, prices, trends and general facts. Use the web search MCP for these when current or external facts are needed.');
  }
  if (hasHf) {
    lines.push('HuggingFace MCP is NOT a general web search engine. Käytä HuggingFace MCP -työkaluja vain AI/ML-malleihin, datasetteihin, Spaceihin, paperihakuihin tai Hugging Face -dokumentaatioon liittyvissä kysymyksissä. Älä käytä HuggingFace-työkaluja yleiseen verkkohakuun, yritystietoihin, henkilöihin, urheilutuloksiin tai uutisiin.');
  }
  return lines.join('\n');
}

function extractIntentText(messagesOrText) {
  if (typeof messagesOrText === 'string') return messagesOrText;
  if (!Array.isArray(messagesOrText)) return '';
  const lastUser = [...messagesOrText].reverse().find(message => String(message?.role || '').toLowerCase() === 'user');
  return serializeIntentContent(lastUser?.content);
}

function serializeIntentContent(content) {
  if (Array.isArray(content)) {
    return content.map(part => typeof part?.text === 'string' ? part.text : '').join(' ');
  }
  return String(content ?? '');
}

function cloneIntegration(integration) {
  return {
    type: integration.type,
    server_label: integration.server_label,
    server_url: integration.server_url,
    allowed_tools: [...integration.allowed_tools],
  };
}

function hasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

const HF_INTENT_PATTERNS = [
  /\bhugging\s*face\b/i,
  /\bhf\s*(hub|docs?|dataset|model|space)\b/i,
  /\b(ai|ml|llm|embedding|embeddings|transformer|transformers|diffusion|inference|finetun(?:e|ing)|fine-tun(?:e|ing))\b/i,
  /\b(model|models|malli|mallit|dataset|datasets|aineisto|paper|papers|arxiv|space|spaces)\b/i,
  /\bqwen\d*|llama|mistral|stable diffusion|bert|clip|whisper\b/i,
];

const WEB_INTENT_PATTERNS = [
  /\b(news|uutiset|breaking|current|latest|today|tänään|nyt|ajankohtainen|tuore)\b/i,
  /\b(nhl|nba|nfl|mlb|f1|formula|liiga|veikkausliiga|sports?|urheilu|tulokset|score|scores)\b/i,
  /\b(company|companies|yritys|yrityksen|oy|oyj|ab|inc|ltd|llc|hallitus|board|ceo|toimitusjohtaja|business)\b/i,
  /\b(person|people|henkilö|kuka on|who is|julkisuuden|founder|perustaja)\b/i,
  /\b(price|prices|hinta|kurssi|bitcoin|btc|eth|stock|osake|valuutta|exchange rate)\b/i,
  /\b(url|https?:\/\/|www\.|website|verkkosivu|sivusto|wikipedia)\b/i,
  /\btrend|trends|trending|suosittu|suosituin\b/i,
];
