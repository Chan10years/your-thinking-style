import { z } from "zod";

const DEFAULT_NICKNAME_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const profilePatchSchema = z.strictObject({
  nickname: z
    .string()
    .trim()
    .min(1, "昵称不能为空。")
    .max(32, "昵称不能超过 32 个字符。"),
});

export type DefaultProfile = {
  nickname: string;
  avatarSeed: string;
};

export function createDefaultProfile(random = Math.random): DefaultProfile {
  let nicknameSuffix = "";
  for (let index = 0; index < 6; index += 1) {
    nicknameSuffix +=
      DEFAULT_NICKNAME_ALPHABET[
        Math.floor(random() * DEFAULT_NICKNAME_ALPHABET.length)
      ];
  }

  return {
    nickname: `用户-${nicknameSuffix}`,
    avatarSeed: crypto.randomUUID(),
  };
}

export function parseProfilePatch(payload: unknown): { nickname: string } {
  const result = profilePatchSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `昵称：${result.error.issues[0]?.message ?? "资料内容不合法。"}`,
    );
  }
  return result.data;
}
