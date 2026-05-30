import type { Env, GoogleAdsTokenResponse, GoogleAdsSearchResponse, CustomerInfo } from "./types.js";

const GOOGLE_ADS_API_VERSION = "v20";
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export class GoogleAdsClient {
  private env: Env;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(env: Env) {
    this.env = env;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        refresh_token: this.env.GOOGLE_REFRESH_TOKEN,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh access token: ${error}`);
    }

    const data = (await response.json()) as GoogleAdsTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "developer-token": this.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
      headers["login-customer-id"] = this.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, "");
    }

    return fetch(url, { ...options, headers });
  }

  async search(customerId: string, query: string, pageSize?: number): Promise<GoogleAdsSearchResponse> {
    const cleanId = customerId.replace(/-/g, "");
    const url = `${GOOGLE_ADS_BASE_URL}/customers/${cleanId}/googleAds:searchStream`;

    const body: Record<string, unknown> = { query };
    if (pageSize) body.pageSize = pageSize;

    const response = await this.request(url, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Ads API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    // searchStream returns an array of batches
    if (Array.isArray(data)) {
      const allResults = data.flatMap((batch: GoogleAdsSearchResponse) => batch.results || []);
      return { results: allResults, requestId: data[0]?.requestId };
    }
    return data as GoogleAdsSearchResponse;
  }

  async listAccessibleCustomers(): Promise<string[]> {
    const url = `${GOOGLE_ADS_BASE_URL}/customers:listAccessibleCustomers`;
    const response = await this.request(url, { method: "GET" });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list accessible customers (${response.status}): ${error}`);
    }

    const data = (await response.json()) as { resourceNames: string[] };
    return data.resourceNames || [];
  }

  async getCustomerDetails(customerId: string): Promise<CustomerInfo | null> {
    try {
      const result = await this.search(customerId, `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.manager,
          customer.status
        FROM customer
        LIMIT 1
      `);

      if (result.results && result.results.length > 0) {
        const customer = result.results[0].customer as Record<string, unknown>;
        return {
          resourceName: `customers/${customerId}`,
          id: String(customer.id),
          descriptiveName: customer.descriptiveName as string | undefined,
          currencyCode: customer.currencyCode as string | undefined,
          timeZone: customer.timeZone as string | undefined,
          manager: customer.manager as boolean | undefined,
          status: customer.status as string | undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  async getResourceMetadata(resourceType: string): Promise<string> {
    const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/googleAdsFields:search`;
    const query = `SELECT name, category, data_type, selectable, filterable, sortable, selectable_with, metrics, segments, is_repeated, type_url, description, attribute_resources WHERE name LIKE '${resourceType}.%' OR name = '${resourceType}'`;

    const response = await this.request(url, {
      method: "POST",
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get resource metadata: ${error}`);
    }

    const data = (await response.json()) as { results?: Array<Record<string, unknown>> };
    return JSON.stringify(data.results || [], null, 2);
  }
}
