import { getAppEdition } from "../../../../config/edition";

function disabledResponse() {
  return Response.json(
    {
      success: false,
      error: { code: "PROFILE_DISABLED", message: "头像功能仅在 hosted 版本提供。" },
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

function invalidAvatarResponse(message: string) {
  return Response.json(
    { success: false, error: { code: "INVALID_AVATAR", message } },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  if (getAppEdition() !== "hosted") {
    return disabledResponse();
  }

  const [{ requireVerifiedSession }, { getUserAvatar }, { createDefaultAvatarResponse }] =
    await Promise.all([
      import("../../../../server/auth/session"),
      import("../../../../server/profile/avatar-service"),
      import("../../../../server/profile/default-avatar"),
    ]);
  const session = await requireVerifiedSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const avatar = await getUserAvatar(session.user.id);
  if ("defaultSeed" in avatar) {
    return createDefaultAvatarResponse(avatar.defaultSeed);
  }
  return new Response(new Uint8Array(avatar.body), {
    headers: {
      "content-type": avatar.contentType,
      "cache-control": "private, max-age=3600",
    },
  });
}

export async function POST(request: Request) {
  if (getAppEdition() !== "hosted") {
    return disabledResponse();
  }

  const [{ requireVerifiedSession }, { saveUserAvatar }] = await Promise.all([
    import("../../../../server/auth/session"),
    import("../../../../server/profile/avatar-service"),
  ]);
  const session = await requireVerifiedSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return invalidAvatarResponse("请使用 multipart/form-data 上传头像。");
  }
  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return invalidAvatarResponse("请选择头像文件。");
  }

  try {
    const profile = await saveUserAvatar(session.user.id, file);
    return Response.json({
      success: true,
      profile: {
        nickname: profile.nickname,
        avatarSeed: profile.avatarSeed,
        avatarPath: profile.avatarPath,
        avatarUrl: "/api/profile/avatar",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("头像") || error.message === "PROFILE_UPDATE_FAILED")
    ) {
      return invalidAvatarResponse(error.message);
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  if (getAppEdition() !== "hosted") {
    return disabledResponse();
  }

  const [{ requireVerifiedSession }, { removeUserAvatar }] = await Promise.all([
    import("../../../../server/auth/session"),
    import("../../../../server/profile/avatar-service"),
  ]);
  const session = await requireVerifiedSession(request);
  if (!session) {
    return unauthorizedResponse();
  }

  const profile = await removeUserAvatar(session.user.id);
  return Response.json({
    success: true,
    profile: {
      nickname: profile.nickname,
      avatarSeed: profile.avatarSeed,
      avatarPath: profile.avatarPath,
      avatarUrl: "/api/profile/avatar",
    },
  });
}
