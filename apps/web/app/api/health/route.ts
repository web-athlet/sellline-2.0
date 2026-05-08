export async function GET() {
  return Response.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
}
