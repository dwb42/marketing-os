import { prisma } from "../src/services/prisma.js";
import { loadEnv } from "../src/config/env.js";
import { newId } from "../src/lib/ids.js";
import { refreshAccessToken } from "../src/connectors/google-ads/auth.js";
import { logger } from "../src/lib/logger.js";

const WORKSPACE = "wsp_pflegemax_team";

async function main() {
  const env = loadEnv();

  const customerId = env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google Ads env vars. Set: GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_DEVELOPER_TOKEN, " +
        "GOOGLE_ADS_OAUTH_CLIENT_ID, GOOGLE_ADS_OAUTH_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN",
    );
  }

  logger.info("testing OAuth token refresh...");
  const tokens = await refreshAccessToken(clientId, clientSecret, refreshToken);
  logger.info({ expiresAt: tokens.expiresAt.toISOString() }, "token refresh ok");

  logger.info("testing Google Ads API with GAQL...");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  }
  const testRes = await fetch(
    `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query: "SELECT customer.id FROM customer LIMIT 1" }),
    },
  );
  if (!testRes.ok) {
    const body = await testRes.text();
    throw new Error(`Google Ads API test failed: ${testRes.status} ${body}`);
  }
  logger.info("API access ok");

  let credentialsValue: object;
  if (env.MOS_CREDENTIAL_KEY) {
    const { encryptSecret } = await import("../src/lib/secrets.js");
    const encrypted = encryptSecret(JSON.stringify({ refreshToken, clientId, clientSecret }));
    credentialsValue = { encrypted };
  } else {
    credentialsValue = { refreshToken, clientId, clientSecret };
  }

  const icaId = newId("integrationAccount");
  const ica = await prisma.integrationAccount.upsert({
    where: {
      workspaceId_channel_externalId: {
        workspaceId: WORKSPACE,
        channel: "GOOGLE_ADS",
        externalId: customerId,
      },
    },
    update: {
      credentials: credentialsValue,
      status: "ACTIVE",
    },
    create: {
      id: icaId,
      workspaceId: WORKSPACE,
      channel: "GOOGLE_ADS",
      label: `Google Ads ${customerId}`,
      externalId: customerId,
      credentials: credentialsValue,
      status: "ACTIVE",
    },
  });

  const cncId = newId("channelConnection");
  const cnc = await prisma.channelConnection.upsert({
    where: { id: ica.id + "_cnc" },
    update: {},
    create: {
      id: cncId,
      workspaceId: WORKSPACE,
      integrationAccountId: ica.id,
      label: `Pflegemax ↔ Google Ads ${customerId}`,
    },
  });

  logger.info(
    {
      integrationAccountId: ica.id,
      channelConnectionId: cnc.id,
      customerId,
    },
    "setup complete",
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
