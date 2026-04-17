import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdaUsdQuote } from "./src/charli3/ada-usd-quote.mjs";
import {
  getMarketQuote,
  listSupportedMarkets,
} from "./src/charli3/market-quote.mjs";
import { getOracleView, listOracleCards } from "./src/charli3/oracle-service.mjs";

const fileName = fileURLToPath(import.meta.url);
const rootDir = path.dirname(fileName);
const publicDir = path.join(rootDir, "public");
const port = Number(process.env.PORT ?? 3000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (requestUrl.pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "hizz-swap-prototype",
        timestamp: new Date().toISOString(),
      });
    }

    if (requestUrl.pathname === "/api/oracles") {
      const cards = await listOracleCards();
      return sendJson(response, 200, { data: cards });
    }

    if (requestUrl.pathname === "/api/markets") {
      return sendJson(response, 200, {
        data: listSupportedMarkets(),
      });
    }

    if (requestUrl.pathname === "/api/quote") {
      const marketId = requestUrl.searchParams.get("market") ?? undefined;
      const quote = await getMarketQuote(marketId);

      if (!quote) {
        return sendJson(response, 404, {
          error: "A live quote is unavailable for the requested market.",
        });
      }

      return sendJson(response, 200, { data: quote });
    }

    if (requestUrl.pathname === "/api/ada-usd") {
      const quote = await getAdaUsdQuote();

      if (!quote) {
        return sendJson(response, 404, {
          error: "ADA/USD quote is unavailable.",
        });
      }

      return sendJson(response, 200, { data: quote });
    }

    if (requestUrl.pathname.startsWith("/api/oracles/")) {
      const id = decodeURIComponent(requestUrl.pathname.replace("/api/oracles/", ""));
      const oracleView = await getOracleView(id);

      if (!oracleView) {
        return sendJson(response, 404, {
          error: `Unknown oracle market: ${id}`,
        });
      }

      return sendJson(response, 200, { data: oracleView });
    }

    if (request.method !== "GET") {
      return sendJson(response, 405, { error: "Method not allowed" });
    }

    return serveStaticAsset(requestUrl.pathname, response);
  } catch (error) {
    return sendJson(response, 500, {
      error: "Internal server error",
      detail: error.message,
    });
  }
});

server.listen(port, () => {
  console.log(`Hizz Swap prototype listening on http://127.0.0.1:${port}`);
});

async function serveStaticAsset(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const assetPath = path.normalize(path.join(publicDir, safePath));

  if (!assetPath.startsWith(publicDir)) {
    return sendJson(response, 403, { error: "Forbidden" });
  }

  try {
    const body = await readFile(assetPath);
    const extension = path.extname(assetPath).toLowerCase();
    response.writeHead(200, {
      "content-type": mimeTypes[extension] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}
