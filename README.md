# Seazone Creative Engine

Gerador autônomo de vídeos para campanhas imobiliárias, construído com Claude Code como orquestrador central.

## Deploy

**URL:** https://seazone-creative-engine.vercel.app

## O que faz

Recebe um **briefing** + **imagens reais do empreendimento** e gera automaticamente vídeos 9:16 (vertical) prontos para Instagram Reels, TikTok e Stories.

### Pipeline de geração:

1. **Upload** de imagens reais (fachada, interior, localização, rooftop)
2. **Text-to-Speech** — gera roteiro e áudio automaticamente a partir do briefing
3. **Image-to-Video** — anima as imagens reais com IA (Kling O1 via Freepik)
4. **Lip Sync** — sincroniza os lábios da apresentadora (Mônica) com o áudio gerado

### Tipos de vídeo:

| Tipo | Descrição |
|------|-----------|
| Mônica apresentando | Apresentadora falando sobre o empreendimento com lip sync |
| Fachada cinematográfica | Vídeo com movimento cinematográfico da fachada |
| Tour interior | Pan suave pelo apartamento/studio |
| Vista aérea | Drone fly-over da localização |
| Rooftop lifestyle | Panorâmica da piscina e áreas comuns |

## Stack Técnica

- **Orquestrador:** Claude Code (Opus 4.6)
- **Frontend:** Next.js 14, React, Tailwind CSS
- **APIs de IA:**
  - Freepik Kling O1 (image-to-video)
  - Freepik Latent Sync (lip sync)
  - Google TTS (text-to-speech)
- **Deploy:** Vercel (serverless)
- **Linguagem:** TypeScript

## Arquitetura

```
Briefing + Imagens
       |
       v
  [/api/generate]
       |
       ├── Gera roteiro (baseado no briefing)
       ├── Gera áudio TTS (voz pt-BR)
       └── Inicia geração de vídeos (Freepik Kling O1)
              |
              v
  [Frontend polling /api/status]
       |
       ├── Checa status na Freepik API
       ├── Quando vídeo pronto → inicia Lip Sync
       └── Quando lip sync pronto → exibe resultado
```

## Contexto Seazone Integrado

O sistema inclui contexto completo da marca:

- **Brand:** cores oficiais (#0055FF, #00143D, #FC6058), tipografia Helvética
- **Tom de voz:** profissional mas humano, nem formal demais nem solto demais
- **Personas:** Investidores Sudeste (SP/MG), Sul (SC/PR/RS), Nacional
- **Missão/Visão** da Seazone
- **Taglines:** "Seu lugar fora de casa", "Gestão de imóveis", "Investimentos"
- **Apresentadora:** Mônica (pré-configurada, fixa para todos os empreendimentos)

## Briefing Padrão: Novo Campeche SPOT II

- **ROI:** 16,40% (acima da Selic)
- **Rendimento:** R$ 5.500/mês
- **Valorização:** 81%
- **Ticket médio:** R$ 350.190,82
- **Localização:** Campeche, Florianópolis - SC

## Como usar

1. Acesse https://seazone-creative-engine.vercel.app
2. Preencha o **briefing** do empreendimento
3. Faça **upload** das imagens (fachada, interior, etc.)
4. Selecione os **tipos de vídeo** desejados
5. Clique em **"Gerar Vídeos com IA"**
6. Aguarde e **baixe** os vídeos prontos

## Configuração local

```bash
git clone https://github.com/arthursergio-hue/seazone-creative-engine.git
cd seazone-creative-engine
npm install
cp .env.example .env.local  # Adicione FREEPIK_API_KEY
npm run dev
```

## Critérios do Hackathon

| Pilar | Como atende |
|-------|-------------|
| **Contexto Seazone (33%)** | BrandBook completo integrado, cores, tom de voz, personas, briefing |
| **Autonomia da IA (33%)** | Pipeline end-to-end: briefing → roteiro → áudio → vídeo → lip sync |
| **Pronto para uso (33%)** | Funciona com qualquer briefing, time pode usar no dia seguinte |

---

Construído com Claude Code (Opus 4.6) + Freepik AI | Hackathon Marketing AI Seazone 2026
