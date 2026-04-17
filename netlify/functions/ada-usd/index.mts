import { getAdaUsdQuote } from "../../../src/charli3/ada-usd-quote.mjs";

export default async () => {
  const data = await getAdaUsdQuote();

  if (!data) {
    return Response.json(
      {
        error: "ADA/USD quote is unavailable.",
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
  path: "/api/ada-usd",
};

