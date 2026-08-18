import { z } from "zod";

import { analysisResponseSchema } from "../../../schemas/analysis-response";
import { buildAnalysisPrompt } from "../../../lib/build-analysis-prompt";
import {
  DEEPSEEK_TIMEOUT_MS,
  DeepSeekError,
  requestDeepSeekAnalysis,
} from "../../../lib/deepseek";
import { INPUT_LIMITS } from "../../../lib/input-validation";
import { analysisRequestGuard } from "../../../lib/analysis-request-guard";
import {
  formatPersonalizedReferenceCodeDiagnostic,
  formatSchemaValidationIssues,
  hasPersonalizedReferenceCodeIssue,
} from "../../../lib/schema-diagnostics";
import {
  attachAnalysisSession,
  resolveAnalysisActor,
} from "../../../server/analysis/actor";

export const maxDuration = 300;

const requiredText = (message: string, maximum?: number) => {
  let schema = z.string();

  if (maximum !== undefined) {
    schema = schema.max(maximum);
  }

  return schema.refine((value) => value.trim().length > 0, { message });
};

const optionalText = (maximum: number) =>
  z.string().max(maximum).optional().default("");

const analysisRequestSchema = z.strictObject({
  problem: requiredText("请填写算法题目。", INPUT_LIMITS.problem),
  code: requiredText("请填写 C++ 代码。", INPUT_LIMITS.code),
  apiKey: requiredText("请填写 DeepSeek API Key。"),
  userThought: optionalText(INPUT_LIMITS.userThought),
  failureInput: optionalText(INPUT_LIMITS.failureInput),
  expectedOutput: optionalText(INPUT_LIMITS.expectedOutput),
  actualOutput: optionalText(INPUT_LIMITS.actualOutput),
});

function errorResponse(code: string, message: string, status: number) {
  return Response.json(
    {
      success: false,
      error: { code, message },
    },
    { status },
  );
}

type ModelValidationPhase = "json_parse" | "schema_validation";

function logModelValidationEvent(
  phase: ModelValidationPhase,
  retryTriggered: boolean,
  elapsedMs: number,
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.error("[DeepSeek Analysis Validation]");
  console.error({
    phase,
    retryTriggered,
    elapsedMs,
  });
}

function logSchemaValidationFailure(
  issues: z.ZodIssue[],
  parsedContent: unknown,
  retryTriggered: boolean,
  elapsedMs: number,
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  logModelValidationEvent("schema_validation", retryTriggered, elapsedMs);

  for (const issue of formatSchemaValidationIssues(issues, parsedContent)) {
    console.error(issue);
  }

  if (hasPersonalizedReferenceCodeIssue(issues)) {
    console.error(formatPersonalizedReferenceCodeDiagnostic(parsedContent));
  }
}

type AnalysisAttemptResult =
  | {
      success: true;
      data: z.infer<typeof analysisResponseSchema>;
    }
  | {
      success: false;
      phase: "json_parse";
      elapsedMs: number;
    }
  | {
      success: false;
      phase: "schema_validation";
      issues: z.ZodIssue[];
      parsedContent: unknown;
      elapsedMs: number;
    };

async function requestAndValidateAnalysis(
  apiKey: string,
  prompt: string,
  timeoutMs: number,
): Promise<AnalysisAttemptResult> {
  const startedAt = Date.now();
  const { content } = await requestDeepSeekAnalysis(
    apiKey,
    prompt,
    timeoutMs,
  );
  const elapsedMs = Date.now() - startedAt;
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(content) as unknown;
  } catch {
    return {
      success: false,
      phase: "json_parse",
      elapsedMs,
    };
  }

  const analysisResult = analysisResponseSchema.safeParse(parsedContent);
  if (!analysisResult.success) {
    return {
      success: false,
      phase: "schema_validation",
      issues: analysisResult.error.issues,
      parsedContent,
      elapsedMs,
    };
  }

  return {
    success: true,
    data: analysisResult.data,
  };
}

function remainingAnalysisBudget(deadline: number) {
  return Math.max(1, deadline - Date.now());
}

type HistoryPersistenceResult = {
  historySaved: boolean;
  historyId?: string;
};

function successResponse(
  data: z.infer<typeof analysisResponseSchema>,
  persistence: HistoryPersistenceResult | null,
) {
  return Response.json({
    success: true,
    data,
    ...(persistence ?? {}),
  });
}

async function persistHostedAnalysis(
  userId: string,
  input: Omit<z.infer<typeof analysisRequestSchema>, "apiKey">,
  result: z.infer<typeof analysisResponseSchema>,
): Promise<HistoryPersistenceResult> {
  try {
    const { persistSuccessfulAnalysis } = await import(
      "../../../server/history/persistence"
    );
    const persistence = await persistSuccessfulAnalysis(
      userId,
      input,
      result as unknown as Record<string, unknown>,
    );
    return {
      historySaved: persistence.historySaved,
      historyId: persistence.historyId,
    };
  } catch {
    return { historySaved: false };
  }
}

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(
      "INVALID_INPUT",
      "请求内容不是合法的 JSON。",
      400,
    );
  }

  const inputResult = analysisRequestSchema.safeParse(requestBody);
  if (!inputResult.success) {
    return errorResponse(
      "INVALID_INPUT",
      "分析内容不合法，请检查必填项和字段长度。",
      400,
    );
  }

  const { apiKey, ...analysisInput } = inputResult.data;
  const prompt = buildAnalysisPrompt(analysisInput);
  const actor = await resolveAnalysisActor(request);
  if (!actor) {
    return errorResponse("AUTH_REQUIRED", "请先登录并验证邮箱。", 401);
  }
  const sessionId = actor.sessionId;
  const requestDecision = analysisRequestGuard.begin(sessionId);

  if (!requestDecision.allowed) {
    if (requestDecision.reason === "in_progress") {
      return attachAnalysisSession(
        errorResponse(
          "ANALYSIS_IN_PROGRESS",
          "当前分析仍在进行中，请等待完成后再试。",
          409,
        ),
        sessionId,
      );
    }

    const response = errorResponse(
      "RATE_LIMIT_EXCEEDED",
      "当前浏览器会话每分钟最多分析 3 次，请稍后再试。",
      429,
    );
    response.headers.set(
      "retry-after",
      String(requestDecision.retryAfterSeconds),
    );
    return attachAnalysisSession(response, sessionId);
  }

  const analysisDeadline = Date.now() + DEEPSEEK_TIMEOUT_MS;

  try {
    const firstAttempt = await requestAndValidateAnalysis(
      apiKey,
      prompt,
      remainingAnalysisBudget(analysisDeadline),
    );

    if (firstAttempt.success) {
      const persistence =
        actor.type === "hosted"
          ? await persistHostedAnalysis(actor.userId, analysisInput, firstAttempt.data)
          : null;
      return attachAnalysisSession(
        successResponse(firstAttempt.data, persistence),
        sessionId,
      );
    }

    if (firstAttempt.phase === "json_parse") {
      logModelValidationEvent(
        "json_parse",
        true,
        firstAttempt.elapsedMs,
      );
    } else {
      logSchemaValidationFailure(
        firstAttempt.issues,
        firstAttempt.parsedContent,
        true,
        firstAttempt.elapsedMs,
      );
    }

    const secondAttempt = await requestAndValidateAnalysis(
      apiKey,
      prompt,
      remainingAnalysisBudget(analysisDeadline),
    );

    if (secondAttempt.success) {
      const persistence =
        actor.type === "hosted"
          ? await persistHostedAnalysis(actor.userId, analysisInput, secondAttempt.data)
          : null;
      return attachAnalysisSession(
        successResponse(secondAttempt.data, persistence),
        sessionId,
      );
    }

    if (secondAttempt.phase === "schema_validation") {
      logSchemaValidationFailure(
        secondAttempt.issues,
        secondAttempt.parsedContent,
        false,
        secondAttempt.elapsedMs,
      );
    } else {
      logModelValidationEvent(
        "json_parse",
        false,
        secondAttempt.elapsedMs,
      );
    }

      return attachAnalysisSession(
        errorResponse(
          "INVALID_MODEL_RESPONSE",
          "DeepSeek 返回的分析结构不符合要求，请稍后重试。",
          502,
        ),
        sessionId,
      );
  } catch (error: unknown) {
    if (error instanceof DeepSeekError) {
      const status =
        error.code === "DEEPSEEK_TIMEOUT"
          ? 504
          : error.code === "DEEPSEEK_CONFIGURATION_ERROR"
            ? 500
            : 502;
      return attachAnalysisSession(
        errorResponse(error.code, error.message, status),
        sessionId,
      );
    }

    return attachAnalysisSession(
      errorResponse(
        "INTERNAL_ERROR",
        "分析请求处理失败，请稍后重试。",
        500,
      ),
      sessionId,
    );
  } finally {
    analysisRequestGuard.finish(sessionId);
  }
}
