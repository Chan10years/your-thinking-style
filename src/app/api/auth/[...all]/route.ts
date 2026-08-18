import { getAppEdition } from "../../../../config/edition";

type AuthMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

function authDisabledResponse() {
  return Response.json(
    {
      success: false,
      error: { code: "AUTH_DISABLED", message: "账户功能仅在 hosted 版本提供。" },
    },
    { status: 404 },
  );
}

async function handle(request: Request, method: AuthMethod): Promise<Response> {
  if (getAppEdition() !== "hosted") {
    return authDisabledResponse();
  }

  const [{ toNextJsHandler }, { getAuth }] = await Promise.all([
    import("better-auth/next-js"),
    import("../../../../server/auth/config"),
  ]);
  const auth = await getAuth();
  return toNextJsHandler(auth)[method](request);
}

export function GET(request: Request) {
  return handle(request, "GET");
}

export function POST(request: Request) {
  return handle(request, "POST");
}

export function PATCH(request: Request) {
  return handle(request, "PATCH");
}

export function PUT(request: Request) {
  return handle(request, "PUT");
}

export function DELETE(request: Request) {
  return handle(request, "DELETE");
}
