export async function POST(
  _request: Request,
  _context: { params: Promise<{ token: string }> }
) {
  return Response.json(
    {
      success: false,
      error: "This legacy decision endpoint is retired. Use /api/customer/approve/[token].",
    },
    { status: 410 }
  );
}
