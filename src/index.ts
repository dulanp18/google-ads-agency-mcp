import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleAdsClient } from "./google-ads-client.js";
import type { Env } from "./types.js";

type State = Record<string, never>;
type Props = Record<string, unknown>;

export class GoogleAdsMCP extends McpAgent<Env, State, Props> {
  server = new McpServer({
    name: "Google Ads Agency MCP",
    version: "1.0.0",
  });

  async init() {
    const client = new GoogleAdsClient(this.env);

    this.server.tool(
      "search",
      "Execute a Google Ads Query Language (GAQL) query against a customer account. " +
        "Use this to pull campaign performance, keyword data, ad group stats, budget info, " +
        "search terms, conversions, and any other Google Ads data. " +
        "Example: SELECT campaign.name, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS",
      {
        customer_id: z.string().describe(
          "The Google Ads customer ID to query (e.g. '123-456-7890' or '1234567890')"
        ),
        query: z.string().describe(
          "A GAQL (Google Ads Query Language) query. Must include SELECT, FROM, and optionally WHERE, ORDER BY, LIMIT clauses."
        ),
        page_size: z.number().optional().describe(
          "Maximum number of results to return (default: all results)"
        ),
      },
      async ({ customer_id, query, page_size }) => {
        try {
          const result = await client.search(customer_id, query, page_size);
          const rows = result.results || [];
          return {
            content: [
              {
                type: "text" as const,
                text: rows.length > 0
                  ? JSON.stringify(rows, null, 2)
                  : "No results found for the given query.",
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error executing query: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    this.server.tool(
      "list_accessible_customers",
      "List all Google Ads customer accounts accessible via the configured credentials. " +
        "Returns customer IDs for all accounts under the MCC (Manager) account. " +
        "Use this first to discover which client accounts are available.",
      {},
      async () => {
        try {
          const resourceNames = await client.listAccessibleCustomers();
          const customerIds = resourceNames.map((rn) =>
            rn.replace("customers/", "")
          );

          const details = await Promise.allSettled(
            customerIds.map((id) => client.getCustomerDetails(id))
          );

          const customers = customerIds.map((id, i) => {
            const detail =
              details[i].status === "fulfilled" ? details[i].value : null;
            return {
              customer_id: id,
              name: detail?.descriptiveName || "Unknown",
              currency: detail?.currencyCode || "Unknown",
              timezone: detail?.timeZone || "Unknown",
              is_manager: detail?.manager || false,
              status: detail?.status || "Unknown",
            };
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(customers, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error listing customers: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    this.server.tool(
      "get_resource_metadata",
      "Get metadata about a Google Ads API resource type, including available fields, " +
        "their data types, and which can be selected/filtered/sorted. " +
        "Use this to discover what fields are available for GAQL queries. " +
        "Example resource types: campaign, ad_group, ad_group_ad, keyword_view, search_term_view",
      {
        resource_type: z.string().describe(
          "The Google Ads API resource type to get metadata for (e.g. 'campaign', 'ad_group', 'keyword_view')"
        ),
      },
      async ({ resource_type }) => {
        try {
          const metadata = await client.getResourceMetadata(resource_type);
          return {
            content: [
              {
                type: "text" as const,
                text: metadata,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error getting metadata: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({
          name: "Google Ads Agency MCP Server",
          version: "1.0.0",
          description: "MCP server for querying Google Ads data across multiple client accounts",
          endpoints: {
            mcp: "/mcp",
            sse: "/sse",
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      return GoogleAdsMCP.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      return GoogleAdsMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
