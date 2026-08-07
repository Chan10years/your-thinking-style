import { getAppEdition } from "../../../config/edition";

function localResponse() {
  return Response.json(
    {
      success: false,
      error: { code: "PROFILE_DISABLED", message: "账户资料仅在 hosted 版本提供。" },
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
    return localResponse();
  }

  const [{ requireVerifiedSession }, { ensureUserProfile }] = await Promise.all([
    import("../../../server/auth/session"),
    import("../../../server/profile/service"),
  ]);
  const session = await requireVerifiedSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const profile = await ensureUserProfile(session.user.id);
  return Response.json({
    success: true,
    profile: {
      nickname: profile.nickname,
      avatarSeed: profile.avatarSeed,
      avatarPath: profile.avatarPath,
    },
  });
}

export async function PATCH(request: Request) {
  if (getAppEdition() !== "hosted") {
    return localResponse();
  }

  const [
    { requireVerifiedSession },
    { ensureUserProfile, updateUserProfile },
    { parseProfilePatch },
  ] = await Promise.all([
    import("../../../server/auth/session"),
    import("../../../server/profile/service"),
    import("../../../server/profile/defaults"),
  ]);
  const session = await requireVerifiedSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "INVALID_INPUT", message: "请求内容不是合法的 JSON。" } },
      { status: 400 },
    );
  }

  try {
    const patch = parseProfilePatch(payload);
    await ensureUserProfile(session.user.id);
    const profile = await updateUserProfile(session.user.id, patch.nickname);
    return Response.json({
      success: true,
      profile: {
        nickname: profile.nickname,
        avatarSeed: profile.avatarSeed,
        avatarPath: profile.avatarPath,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("昵称")) {
      return Response.json(
        { success: false, error: { code: "INVALID_INPUT", message: error.message } },
        { status: 400 },
      );
    }
    throw error;
  }
}
