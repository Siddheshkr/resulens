import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";

export async function GET() {
  try {
    await requireUser();
    return Response.json({ status: "ok" });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    throw error;
  }
}
