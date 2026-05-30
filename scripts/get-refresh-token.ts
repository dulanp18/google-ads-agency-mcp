import http from "node:http";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = "http://localhost:3333/callback";
const SCOPES = "https://www.googleapis.com/auth/adwords";

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:3333`);

  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("No authorization code received");
      return;
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json() as Record<string, unknown>;

      if (tokenData.refresh_token) {
        console.log("\n=== SUCCESS ===");
        console.log(`Refresh Token: ${tokenData.refresh_token}`);
        console.log("===============\n");

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Success!</h1><p>Refresh token has been printed to your terminal. You can close this tab.</p>");
      } else {
        console.error("No refresh token in response:", tokenData);
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Error</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
      }
    } catch (err) {
      console.error("Token exchange failed:", err);
      res.writeHead(500);
      res.end("Token exchange failed");
    }

    setTimeout(() => process.exit(0), 1000);
  }
});

server.listen(3333, () => {
  console.log("\nOpen this URL in your browser to authorize:\n");
  console.log(authUrl.toString());
  console.log("\nWaiting for callback on http://localhost:3333/callback...\n");
});
