# Hexa SmartLedger

AI-powered journal entry anomaly detection for Zoho Books — built with Next.js 14 and **Claude (claude-sonnet-4-6)**.

---

## Quick start (5 minutes)

### 1. Install dependencies

```bash
cd hexa-smartledger
npm install
```

### 2. Set up your API key

```bash
cp .env.local.example .env.local
```

Open `.env.local` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

Get your key at → https://console.anthropic.com/

### 3. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## Architecture

```
hexa-smartledger/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/route.ts      ← Claude API route (POST)
│   │   │   └── zoho-test/route.ts    ← Zoho connection test (POST)
│   │   ├── globals.css               ← Light design system tokens
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── SmartLedger.tsx           ← Full UI (all pages + logic)
│   └── lib/
│       ├── types.ts                  ← TypeScript interfaces
│       └── utils.ts                  ← Zoho fetch, Claude caller, demo data
├── .env.local.example                ← Copy → .env.local
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## How Claude is integrated

All AI analysis goes through **`src/app/api/analyze/route.ts`**:

```
Client UI  →  POST /api/analyze  →  Anthropic SDK  →  claude-sonnet-4-6
                    ↑
            (ANTHROPIC_API_KEY set server-side — never exposed to browser)
```

The API route receives journal entry data, runs 5 analysis sections sequentially, then generates an executive summary. Each call uses a structured forensic-accounting system prompt (CFE-grade).

**Model used:** `claude-sonnet-4-6`
**Max tokens per call:** 4,096
**Calls per full analysis:** 6 (5 sections + 1 summary)

---

## Zoho Books integration

To connect Zoho Books:

1. Go to https://api-console.zoho.com/
2. Create a Self Client application
3. Generate a token with scope: `ZohoBooks.fullaccess.all`
4. In SmartLedger → Settings → add your Organization ID + Access Token
5. Select your region (`.com`, `.in`, `.com.au`, `.eu`, `.jp`)

The Zoho connection test (`/api/zoho-test`) proxies through the Next.js backend to avoid CORS issues.

---

## Analysis sections

| Section | What Claude checks |
|---|---|
| **Completeness** | Unbalanced entries, missing fields, sequence gaps |
| **Anomalies** | Statistical outliers, round numbers, weekend postings |
| **Duplicates** | Exact/near-duplicates, reversed entries |
| **Period-End** | Month-end clustering, late postings, accrual reversals |
| **Compliance** | Segregation of duties, authorization limits, after-hours |

---

## Production deployment

```bash
npm run build
npm start
```

Or deploy to Vercel:

```bash
npx vercel --prod
```

Set `ANTHROPIC_API_KEY` in your Vercel environment variables.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key |
| `CLAUDE_MODEL` | No | Override model (default: `claude-sonnet-4-6`) |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for production |

---

## Security notes

- `ANTHROPIC_API_KEY` lives only in `.env.local` — never in the browser
- Zoho Access Tokens are stored in browser `localStorage` (client-side only)
- For production, consider encrypting tokens server-side and using sessions
- `.env.local` is in `.gitignore` — never commit it

---

Built by Hexa · SmartLedger v1.0
