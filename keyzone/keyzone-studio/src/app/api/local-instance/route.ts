export async function GET(request: Request) {
  return Response.json({ instance: process.env.KEYZONE_INSTANCE_ID || null, host: request.headers.get("host") }, { headers: { "Cache-Control": "no-store" } });
}
