import type { AnalysisInput } from "@/lib/input-validation";
import { analysisResponseSchema } from "@/schemas/analysis-response";
import type { AnalysisResponse } from "@/types/analysis";

export type AnalysisRequestResult =
  | { success: true; data: AnalysisResponse }
  | { success: false; message: string };

type AnalysisPageSubmissionState = {
  analysisResult: AnalysisResponse | null;
  activeErrorId: string | null;
  serverMessage: string;
  submitState: "idle" | "valid" | "invalid" | "submitting" | "success" | "error";
};

function hasAnalysisData(
  payload: unknown,
): payload is { success: true; data: AnalysisResponse } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "success" in payload &&
    payload.success === true &&
    "data" in payload &&
    typeof payload.data === "object" &&
    payload.data !== null
  );
}

function getErrorMessage(payload: unknown) {
  return typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
    ? payload.error.message
    : "分析请求失败，请稍后重试。";
}

async function parseAnalysisServicePayload(response: Response) {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {
      success: false as const,
      message: "分析服务返回的内容无法解析，请稍后重试。",
    };
  }

  try {
    return {
      success: true as const,
      payload: JSON.parse(text) as unknown,
    };
  } catch {
    return {
      success: false as const,
      message: "分析服务返回的内容无法解析，请稍后重试。",
    };
  }
}

function redactApiKey(message: string, input: AnalysisInput) {
  const apiKey = input.apiKey.trim();

  return apiKey.length > 0 ? message.replaceAll(apiKey, "[API Key]") : message;
}

export function canStartAnalysisRequest(isSubmitting: boolean) {
  return !isSubmitting;
}

export async function requestAnalysis(
  input: AnalysisInput,
  fetcher: typeof fetch = fetch,
): Promise<AnalysisRequestResult> {
  try {
    const response = await fetcher("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const parsedPayload = await parseAnalysisServicePayload(response);

    if (!parsedPayload.success) {
      return parsedPayload;
    }

    const payload = parsedPayload.payload;

    if (!response.ok) {
      const message =
        getErrorMessage(payload) === "分析请求失败，请稍后重试。"
          ? `分析服务返回错误状态 ${response.status}，请稍后重试。`
          : getErrorMessage(payload);

      return {
        success: false,
        message: redactApiKey(message, input),
      };
    }

    if (hasAnalysisData(payload)) {
      const analysisResult = analysisResponseSchema.safeParse(payload.data);

      if (!analysisResult.success) {
        return {
          success: false,
          message: "分析服务返回的分析结构不符合要求，请稍后重试。",
        };
      }

      return {
        success: true,
        data: analysisResult.data,
      };
    }

    return {
      success: false,
      message: redactApiKey(getErrorMessage(payload), input),
    };
  } catch {
    return {
      success: false,
      message: "无法连接分析服务，请检查网络后重试。",
    };
  }
}

export function applyAnalysisSuccess<
  TState extends AnalysisPageSubmissionState,
>(state: TState, analysis: AnalysisResponse): TState {
  return {
    ...state,
    analysisResult: analysis,
    activeErrorId: null,
    serverMessage: "",
    submitState: "success",
  };
}

export function applyAnalysisFailure<TState extends AnalysisPageSubmissionState>(
  state: TState,
  message: string,
): TState {
  return {
    ...state,
    serverMessage: message,
    submitState: "error",
  };
}
