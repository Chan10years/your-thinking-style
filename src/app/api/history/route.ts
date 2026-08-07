import { getAppEdition } from "../../../config/edition";

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

export async function GET(request: Request) {
  if (getAppEdition() !== "hosted") {
    return disabledResponse();
  }

  const [{ requireVerifiedSession }, { listUserHistory }, { parseHistoryListQuery }] =
    await Promise.all([
      import("../../../server/auth/session"),
      import("../../../server/history/repository"),
      import("../../../server/history/query"),
    ]);
  const session = await requireVerifiedSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let query;
  try {
    query = parseHistoryListQuery(new URL(request.url).searchParams);
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: error instanceof Error ? error.message : "分页参数不合法。",
        },
      },
      { status: 400 },
    );
  }

  const items = await listUserHistory(session.user.id, query);
  return Response.json({
    success: true,
    items,
    nextOffset: items.length === query.limit ? query.offset + query.limit : null,
  });
}
