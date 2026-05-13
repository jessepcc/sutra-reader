// Same-origin proxy to the CBETA Open Data REST API.
//   /api/cbeta/<segments…>?<query>  →  https://cbdata.dila.edu.tw/stable/<segments…>?<query>
//
// CBETA only emits Access-Control-Allow-Origin for Origin: https://cbeta.org,
// so browsers cannot call it directly. This Pages Function runs server-side,
// fetches upstream, and returns the body with ACAO: * plus edge-cacheable
// Cache-Control headers.

const UPSTREAM = "https://cbdata.dila.edu.tw/stable";

// Browser caches 30 days; edge can hold a bit longer since CBETA releases
// are versioned (e.g. 2026R1) and only roll over a couple times a year.
const BROWSER_MAX_AGE = 60 * 60 * 24;
const EDGE_MAX_AGE = 60 * 60 * 24 * 30;

interface RouteParams {
  path: string | string[];
}

export async function onRequestGet(context: {
  request: Request;
  params: RouteParams;
}): Promise<Response> {
  const { request, params } = context;
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const url = new URL(request.url);
  const upstreamUrl = `${UPSTREAM}/${segments.join("/")}${url.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { accept: "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "upstream_unreachable", detail: String(err) }),
      {
        status: 502,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      },
    );
  }

  const headers = new Headers(upstream.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("vary", "accept-encoding");
  headers.set(
    "cache-control",
    `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${EDGE_MAX_AGE}`,
  );
  // Don't leak upstream cookies to the browser.
  headers.delete("set-cookie");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}
