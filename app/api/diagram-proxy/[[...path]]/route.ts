import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/_server/actions/users";
import { getSettings } from "@/app/_server/actions/config";

export const dynamic = "force-dynamic";

const getDrawioTargetUrl = (
  drawioUrl: string,
  pathSegments: string[],
  searchParams: string,
): string | null => {
  try {
    const baseUrl = new URL(drawioUrl);
    if (
      !["http:", "https:"].includes(baseUrl.protocol) ||
      baseUrl.username ||
      baseUrl.password
    ) {
      return null;
    }

    const safeSegments = pathSegments.map((segment) =>
      encodeURIComponent(segment),
    );
    const basePath = baseUrl.pathname.endsWith("/")
      ? baseUrl.pathname.slice(0, -1)
      : baseUrl.pathname;
    baseUrl.pathname = [basePath, ...safeSegments].filter(Boolean).join("/");
    baseUrl.search = searchParams;

    return baseUrl.toString();
  } catch {
    return null;
  }
};

async function proxyDrawioRequest(
  request: NextRequest,
  params: { path?: string[] }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const settings = await getSettings();
    const drawioUrl = settings?.editor?.drawioUrl || "https://embed.diagrams.net";
    const proxyEnabled = settings?.editor?.drawioProxyEnabled || false;

    if (!proxyEnabled) {
      return new NextResponse("Draw.io proxy is not enabled", { status: 403 });
    }

    const pathSegments = params?.path || [];

    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();

    const targetUrl = getDrawioTargetUrl(drawioUrl, pathSegments, searchParams);
    if (!targetUrl) {
      return new NextResponse("Invalid Draw.io proxy target", { status: 400 });
    }

    console.log(`[Draw.io Proxy] ${request.method} ${url.pathname}${url.search} -> ${targetUrl}`);

    const headers = new Headers();

    const headersToForward = [
      "accept",
      "accept-encoding",
      "accept-language",
      "cache-control",
      "content-type",
      "user-agent",
    ];

    headersToForward.forEach((headerName) => {
      const value = request.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    });

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    if (request.method === "POST" || request.method === "PUT") {
      fetchOptions.body = await request.text();
    }

    const response = await fetch(targetUrl, fetchOptions);

    const contentType = response.headers.get("content-type") || "";

    let responseBody: ArrayBuffer | string = await response.arrayBuffer();

    if (contentType.includes("text/html")) {
      let html = new TextDecoder().decode(responseBody);
      const baseTag = '<base href="/api/diagram-proxy/">';
      html = html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
      html = html.replace(
        /(src|href|action|data|content)\s*=\s*["']\/([^"'\s>]+)["']/gi,
        (match, attr, path) => {
          if (path.startsWith('api/diagram-proxy/') || path.startsWith('http')) {
            return match;
          }
          return `${attr}="/api/diagram-proxy/${path}"`;
        }
      );
      responseBody = html;
    }

    const responseHeaders = new Headers();

    const responseHeadersToForward = [
      "content-type",
      "cache-control",
      "expires",
      "last-modified",
      "etag",
    ];

    responseHeadersToForward.forEach((headerName) => {
      const value = response.headers.get(headerName);
      if (value) {
        responseHeaders.set(headerName, value);
      }
    });

    if (typeof responseBody === "string") {
      responseHeaders.set("content-length", String(new Blob([responseBody]).size));
    }
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type");

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Draw.io proxy error:", error);
    return new NextResponse("Failed to proxy Draw.io request", { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  return proxyDrawioRequest(request, params);
}

export async function POST(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  return proxyDrawioRequest(request, params);
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
