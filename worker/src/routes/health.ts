export function handleHealth(): Response {
  return Response.json(
    { success: true, status: "ok" },
    { headers: { "Vary": "Origin" } },
  );
}
