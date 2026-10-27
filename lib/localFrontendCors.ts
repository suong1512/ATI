const localFrontendOrigins = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

export function withLocalFrontendCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  if (process.env.NODE_ENV === "production" || !origin || !localFrontendOrigins.has(origin)) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export function handleLocalFrontendOptions(request: Request): Response {
  return withLocalFrontendCors(request, new Response(null, { status: 204 }));
}
