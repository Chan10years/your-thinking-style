import { getAppEdition } from "../../../../config/edition";

const HISTORY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function disabledResponse() {
  return Response.json(
    {
      success: false,
      error: { code: "HISTORY_DISABLED", message: "历史记录仅在 hosted 版本提供。" },
    },
    { status: 404 },
  );
}

function unauthorizedResponse() {
  return Response.json(
    {
      success: false,
      error: { code: "AUTH_REQUIRED", message: "请先登录并验证邮箱。" },
    },
    { status: 401 },
  );
}

type RouteContext = { params: Promise<{ id: string }> };

async function getActor(request: Request) {
  const { requireVerifiedSession } = await import(
    "../../../../server/auth/session"
  );
  return requireVerifiedSession(request);
}

export async function GET(request: Request, context: RouteContext) {
  if (getAppEdition() !== "hosted") {
    return disabledResponse();
  }
  const session = await getActor(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  if (!HISTORY_ID_PATTERN.test(id)) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "历史记录不存在。" } },
      { status: 404 },
    );
  }
  const { getUserHistory } = await import("../../../../server/history/repository");
  const item = await getUserHistory(session.user.id, id);
  if (!item) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "历史记录不存在。" } },
      { status: 404 },
    );
  }
  return Response.json({ success: true, item });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (getAppEdition() !== "hosted") {
    return disabledResponse();
  }
  const session = await getActor(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;
  if (!HISTORY_ID_PATTERN.test(id)) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "历史记录不存在。" } },
      { status: 404 },
    );
  }
  const { deleteUserHistory } = await import(
    "../../../../server/history/repository"
  );
  const deleted = await deleteUserHistory(session.user.id, id);
  if (!deleted) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "历史记录不存在。" } },
      { status: 404 },
    );
  }
  return Response.json({ success: true });
}
