export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "resulens",
    version: process.env.npm_package_version ?? "0.1.0",
  });
}
