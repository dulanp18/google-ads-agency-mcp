# Google Ads MCP Server — Deployment Guide

Deploy your own Google Ads MCP server and connect it to Claude as a Custom Connector. This gives your team natural language access to Google Ads data — campaign performance, keyword analytics, budget pacing, and more — directly inside Claude.

## Prerequisites

Before you start, make sure you have:

- [ ] A **Google Ads MCC (Manager) account** with API access enabled
- [ ] A **Google Ads Developer Token** (from Google Ads > Tools & Settings > API Center)
- [ ] A **Google Cloud project** with the **Google Ads API enabled**
- [ ] A **Cloudflare account** (free tier is fine — covers 100k requests/day)
- [ ] **Node.js 18+** installed locally
- [ ] A **Claude Team or Pro plan** (for Custom Connectors)

---

## Step 1: Clone the repo

```bash
git clone https://github.com/dulanp18/google-ads-agency-mcp.git
cd google-ads-agency-mcp
npm install
```

---

## Step 2: Set up Google Cloud OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Go to **APIs & Services > Library**, search for **Google Ads API**, and click **Enable**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: anything (e.g. "Google Ads MCP")
   - Authorized redirect URIs: add `http://localhost:3333/callback`
6. Copy the **Client ID** and **Client Secret**

---

## Step 3: Generate a Google OAuth Refresh Token

Run the included helper script:

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx tsx scripts/get-refresh-token.ts
```

This starts a local server and prints a URL. Open it in your browser, sign in with the Google account that has access to your MCC, and approve. The refresh token will be printed in your terminal.

---

## Step 4: Configure local environment

Copy the example env file and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=your-mcc-id-without-dashes
MCP_SECRET_TOKEN=generate-a-random-string-here
ALLOWED_CUSTOMER_IDS=your-permitted-customer-ids-comma-separated
```

`ALLOWED_CUSTOMER_IDS` locks the server to specific Google Ads accounts. Both `search` and
`list_accessible_customers` will only ever touch accounts in this list, regardless of what
the MCC can reach. Dashes are optional, and multiple IDs are comma-separated (e.g.
`1234567890,0987654321`). **If this is empty or unset, all account access is denied.**

To generate a secure random token for `MCP_SECRET_TOKEN`:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Step 5: Test locally

```bash
npx wrangler dev
```

The server starts at `http://localhost:8787`. Test with curl:

```bash
# Should return server info
curl http://localhost:8787/

# Should return 401 (no token)
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# Should succeed (with your token)
curl -X POST http://localhost:8787/mcp/YOUR_MCP_SECRET_TOKEN \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

---

## Step 6: Deploy to Cloudflare Workers

### First-time Cloudflare setup

```bash
npx wrangler login
```

If this is a brand new Cloudflare account, you may also need to:
- Verify your email (check inbox)
- Visit the [Workers dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages) to auto-create your workers.dev subdomain

### Deploy

```bash
npx wrangler deploy
```

This gives you a URL like: `https://google-ads-agency-mcp.your-subdomain.workers.dev`

### Set secrets

```bash
echo "your-client-id" | npx wrangler secret put GOOGLE_CLIENT_ID
echo "your-client-secret" | npx wrangler secret put GOOGLE_CLIENT_SECRET
echo "your-developer-token" | npx wrangler secret put GOOGLE_ADS_DEVELOPER_TOKEN
echo "your-refresh-token" | npx wrangler secret put GOOGLE_REFRESH_TOKEN
echo "your-mcc-id" | npx wrangler secret put GOOGLE_ADS_LOGIN_CUSTOMER_ID
echo "your-secret-token" | npx wrangler secret put MCP_SECRET_TOKEN
echo "1234567890,0987654321" | npx wrangler secret put ALLOWED_CUSTOMER_IDS
```

### Verify deployment

```bash
curl https://your-worker-name.your-subdomain.workers.dev/
# Should return: {"name":"Google Ads Agency MCP Server","version":"1.0.0"}
```

---

## Step 7: Add as Custom Connector in Claude

1. Open Claude (claude.ai, Claude Desktop, or Co-work)
2. Go to **Settings > Connectors > Add Custom Connector**
3. Enter your server URL:
   ```
   https://your-worker-name.your-subdomain.workers.dev/mcp/YOUR_MCP_SECRET_TOKEN
   ```
4. Save and toggle the connector on in a conversation
5. Test by asking: **"List all accessible Google Ads accounts"**

For **Team plans**: an Owner/Admin adds the connector once, and all team members can enable it.

---

## Available tools

Once connected, Claude has access to three tools:

| Tool | What it does |
|------|-------------|
| `list_accessible_customers` | Lists all Google Ads accounts under your MCC |
| `search` | Runs any GAQL query — campaign stats, keywords, search terms, budgets, conversions, etc. |
| `get_resource_metadata` | Shows available fields for a resource type (useful for building queries) |

### Example questions you can ask Claude

- "Show me the top 10 campaigns by spend in the last 30 days for account 1234567890"
- "What are the search terms driving the most conversions for campaign X?"
- "Compare ROAS across all campaigns for the last 7 days vs previous 7 days"
- "Which keywords have a quality score below 5?"
- "Show me budget utilisation for all active campaigns"

---

## Troubleshooting

### "Error 404 (Not Found)" from Google Ads API
The Google Ads API may not be enabled on your Google Cloud project. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library) and enable "Google Ads API".

### "Access blocked" during OAuth
Your OAuth client might be set to "Web application" type. Make sure `http://localhost:3333/callback` is in the Authorized redirect URIs.

### SSL handshake failure on curl
New Cloudflare Workers subdomains can take a few minutes to provision SSL certificates. Try again after 5 minutes, or test in a browser first.

### "Unauthorized" when connecting
Check that your `MCP_SECRET_TOKEN` in the URL matches the one set via `wrangler secret put`.

### Some accounts show "Unknown"
Your MCC credentials may not have access to query details for all linked accounts. The accounts are still listed by ID.

---

## Security notes

- **Never commit `.dev.vars`** — it contains your credentials and is gitignored
- The `MCP_SECRET_TOKEN` in the URL is your access control — treat it like a password
- Only share the full URL (with token) with people you want to have access
- To revoke access: generate a new token, update via `wrangler secret put`, and redeploy
- For stronger security, consider adding OAuth 2.1 authentication (see Cloudflare's [workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider))
