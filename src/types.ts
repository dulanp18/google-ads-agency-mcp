export interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  OAUTH_KV?: KVNamespace;
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: string;
}

export interface GoogleAdsTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleAdsSearchResponse {
  results?: GoogleAdsRow[];
  fieldMask?: string;
  requestId?: string;
  nextPageToken?: string;
}

export interface GoogleAdsRow {
  [key: string]: unknown;
}

export interface CustomerInfo {
  resourceName: string;
  id: string;
  descriptiveName?: string;
  currencyCode?: string;
  timeZone?: string;
  manager?: boolean;
  status?: string;
}
