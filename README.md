# Google Ads Agency MCP Server

A remote MCP (Model Context Protocol) server that lets your team query Google Ads data from Claude Desktop / Co-work using natural language. Runs on Cloudflare Workers.

## What it does

Your team toggles on the "Google Ads" connector in Claude, then asks questions like:
- "Show me ROAS by campaign for client X last 30 days"
- "List all accessible Google Ads accounts"
- "Pull search term report for campaign Y last 7 days"
- "Show budget utilisation across all active campaigns"

Claude calls the MCP tools which query the Google Ads API directly.

## Tools exposed

| Tool | Description |
|------|-------------|
| `search` | Execute any GAQL (Google Ads Query Language) query — campaigns, keywords, ads, conversions, budgets |
| `list_accessible_customers` | List all client accounts under your MCC with names, currencies, and status |
| `get_resource_metadata` | Discover available fields for any Google Ads resource type |

## Prerequisites

1. **Google Ads MCC (Manager) account** with API access
2. **Google Cloud project** with the Google Ads API enabled
3. **OAuth 2.0 credentials** (client ID + secret) from Google Cloud Console
4. **Developer token** from your MCC account (Google Ads → Tools → API Center)
5. **Cloudflare account** (free tier works)
6. **Node.js 18+** and `wrangler` CLI

## Setup

### 1. Get Google Ads API credentials

If you haven't already:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing) and enable the **Google Ads API**
3. Create **OAuth 2.0 credentials** (Desktop app type)
4. Note your **Client ID** and **Client Secret**
5. Get your **Developer Token** from Google Ads → Tools & Settings → API Center
6. Generate a **Refresh Token** using the OAuth playground or the Google Ads API client library

### 2. Set up Cloudflare

```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Create the KV namespace for OAuth state
npx wrangler kv namespace create OAUTH_KV
# Copy the ID from the output into wrangler.jsonc
```

### 3. Configure secrets

```bash
# Set each secret (you'll be prompted to enter the value)
npx wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npx wrangler secret put GOOGLE_ADS_LOGIN_CUSTOMER_ID
```

The `GOOGLE_ADS_LOGIN_CUSTOMER_ID` is your MCC account ID (without dashes).

### 4. Deploy

```bash
npm run deploy
```

This gives you a URL like `https://google-ads-agency-mcp.<your-subdomain>.workers.dev`

### 5. Add as Custom Connector in Claude

1. Open Claude Desktop / Co-work
2. Go to **Settings → Connectors → Add Custom Connector**
3. Enter your server URL: `https://google-ads-agency-mcp.<your-subdomain>.workers.dev/mcp`
4. For Team plans: an Owner adds it once, all members can enable it

### 6. Test

Toggle on the connector in a conversation and try:
- "List all accessible Google Ads accounts"
- "Show me the top 5 campaigns by cost for account [ID] in the last 30 days"

## Local development

```bash
# Create a .dev.vars file with your secrets for local testing
cat > .dev.vars << 'EOF'
GOOGLE_ADS_DEVELOPER_TOKEN=your-dev-token
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890
EOF

# Start local dev server
npm run dev
```

The server will be available at `http://localhost:8787/mcp`

## GAQL query examples

```sql
-- Campaign performance last 30 days
SELECT campaign.name, metrics.cost_micros, metrics.conversions,
       metrics.conversions_value, metrics.clicks, metrics.impressions
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC

-- Search term report
SELECT search_term_view.search_term, metrics.clicks, metrics.impressions,
       metrics.cost_micros, metrics.conversions
FROM search_term_view
WHERE segments.date DURING LAST_7_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 50

-- Budget pacing
SELECT campaign.name, campaign_budget.amount_micros,
       metrics.cost_micros, campaign.status
FROM campaign
WHERE campaign.status = 'ENABLED'

-- Keyword performance
SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
       metrics.clicks, metrics.impressions, metrics.cost_micros,
       metrics.conversions, metrics.average_cpc
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 100
```

## Architecture

```
Team member in Co-work
        ↓ (natural language)
Claude (Anthropic cloud)
        ↓ (MCP tool call over Streamable HTTP)
Cloudflare Worker (this server)
        ↓ (Google Ads REST API)
Google Ads API
        ↓
Data returned → Claude formats the answer
```

## Security

- Credentials are stored as Cloudflare Worker secrets (encrypted at rest)
- The server uses OAuth 2.0 to authenticate with Google Ads
- `ALLOWED_CUSTOMER_IDS` restricts all tools to a fixed set of accounts; access to any account not on the list is denied (and an empty/unset list denies everything)
- For production, consider adding authentication to the MCP endpoint itself
- On Team/Enterprise Claude plans, only Owners can add custom connectors
