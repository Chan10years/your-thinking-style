export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";
export const DEEPSEEK_TIMEOUT_MS = 270_000;

const DEFAULT_DEEPSEEK_ENDPOINT =
  "https://api.deepseek.com/chat/completions";

export type DeepSeekErrorCode =
  | "DEEPSEEK_CONFIGURATION_ERROR"
  | "DEEPSEEK_REQUEST_FAILED"
  | "DEEPSEEK_TIMEOUT"
  | "DEEPSEEK_INVALID_RESPONSE"
  | "EMPTY_MODEL_RESPONSE";

export class DeepSeekError extends Error {
  constructor(
    public readonly code: DeepSeekErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalEnvValue(name: string) {
  const value = process.env[name]?.trim();

  return value && value.length > 0 ? value : null;
}

export function getDeepSeekRuntimeConfig() {
  const endpoint = getOptionalEnvValue("DEEPSEEK_API_ENDPOINT");
  const model = getOptionalEnvValue("DEEPSEEK_MODEL");

  if (process.env.NODE_ENV === "production" && (!endpoint || !model)) {
    throw new DeepSeekError(
      "DEEPSEEK_CONFIGURATION_ERROR",
      "服务端 DeepSeek 配置缺失，请联系部署维护者。",
    );
  }

  return {
    endpoint: endpoint ?? DEFAULT_DEEPSEEK_ENDPOINT,
    model: model ?? DEFAULT_DEEPSEEK_MODEL,
  };
}

export type DeepSeekAnalysisResult = {
  content: string;
  finishReason: string;
};

function extractAnalysisResult(body: unknown): DeepSeekAnalysisResult | null {
  if (!isRecord(body) || !Array.isArray(body.choices)) {
    return null;
  }

  const firstChoice = body.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  const content = firstChoice.message.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }

  return {
    content,
    finishReason:
      typeof firstChoice.finish_reason === "string"
        ? firstChoice.finish_reason
        : "unknown",
  };
}

export async function requestDeepSeekAnalysis(
  apiKey: string,
  prompt: string,
  timeoutMs = DEEPSEEK_TIMEOUT_MS,
) {
  const config = getDeepSeekRuntimeConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "你只返回符合用户指定结构的 JSON 对象，不输出 JSON 以外的内容。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        thinking: { type: "enabled" },
        reasoning_effort: "high",
        stream: false,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new DeepSeekError(
        "DEEPSEEK_REQUEST_FAILED",
        "DeepSeek 请求失败，请检查 API Key 或稍后重试。",
      );
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      if (controller.signal.aborted) {
        throw new DeepSeekError(
          "DEEPSEEK_TIMEOUT",
          "DeepSeek 深度分析超过 4 分 30 秒，请稍后重试或减少输入内容。",
        );
      }

      throw new DeepSeekError(
        "DEEPSEEK_INVALID_RESPONSE",
        "DeepSeek 返回内容无法解析，请稍后重试。",
      );
    }

    const result = extractAnalysisResult(body);

    if (result === null) {
      throw new DeepSeekError(
        "EMPTY_MODEL_RESPONSE",
        "DeepSeek 返回了空内容，请稍后重试。",
      );
    }

    return result;
  } catch (error: unknown) {
    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new DeepSeekError(
        "DEEPSEEK_TIMEOUT",
        "DeepSeek 深度分析超过 4 分 30 秒，请稍后重试或减少输入内容。",
      );
    }

    throw new DeepSeekError(
      "DEEPSEEK_REQUEST_FAILED",
      "DeepSeek 请求失败，请检查网络、API Key 或稍后重试。",
    );
  } finally {
    clearTimeout(timeout);
  }
}
