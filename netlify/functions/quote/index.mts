import { getMarketQuote, listSupportedMarkets } from "../../../src/charli3/market-quote.mjs";

export default async (request: Request) => {
  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === "/api/markets") {
    return Response.json(
      {
        data: listSupportedMarkets(),
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  const marketId = requestUrl.searchParams.get("market") ?? undefined;
  const apiKey = Netlify.env.get("CHARLI3_API_KEY");
  const data = await getMarketQuote(marketId, { apiKey });

  if (!data) {
    return Response.json(
      {
        error: "A live quote is unavailable for the requested market.",
      },
      {
        status: 404,
      },
    );
  }

  return Response.json(
    {
      data,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
};

export const config = {
  path: ["/api/quote", "/api/markets"],
};
