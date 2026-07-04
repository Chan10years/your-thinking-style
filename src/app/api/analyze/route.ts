import { z } from "zod";

import { analysisResponseSchema } from "../../../schemas/analysis-response";
import { buildAnalysisPrompt } from "../../../lib/build-analysis-prompt";
import {
  DeepSeekError,
  requestDeepSeekAnalysis,
} from "../../../lib/deepseek";
import { INPUT_LIMITS } from "../../../lib/input-validation";
import {
  formatPersonalizedReferenceCodeDiagnostic,
  formatSchemaValidationIssues,
  hasPersonalizedReferenceCodeIssue,
} from "../../../lib/schema-diagnostics";

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
): Promise<AnalysisAttemptResult> {
  const startedAt = Date.now();
  const { content } = await requestDeepSeekAnalysis(
    apiKey,
    prompt,
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

  try {
    const firstAttempt = await requestAndValidateAnalysis(
      apiKey,
      prompt,
    );

    if (firstAttempt.success) {
      return Response.json({
        success: true,
        data: firstAttempt.data,
      });
    }

    if (firstAttempt.phase === "json_parse") {
      logModelValidationEvent(
        "json_parse",
        false,
        firstAttempt.elapsedMs,
      );
      return errorResponse(
        "INVALID_MODEL_JSON",
        "DeepSeek 返回的内容不是合法 JSON，请稍后重试。",
        502,
      );
    }

    logSchemaValidationFailure(
      firstAttempt.issues,
      firstAttempt.parsedContent,
      true,
      firstAttempt.elapsedMs,
    );

    const secondAttempt = await requestAndValidateAnalysis(
      apiKey,
      prompt,
    );

    if (secondAttempt.success) {
      return Response.json({
        success: true,
        data: secondAttempt.data,
      });
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

      return errorResponse(
        "INVALID_MODEL_RESPONSE",
        "DeepSeek 返回的分析结构不符合要求，请稍后重试。",
        502,
      );
  } catch (error: unknown) {
    if (error instanceof DeepSeekError) {
      const status =
        error.code === "DEEPSEEK_TIMEOUT"
          ? 504
          : error.code === "DEEPSEEK_CONFIGURATION_ERROR"
            ? 500
            : 502;
      return errorResponse(error.code, error.message, status);
    }

    return errorResponse(
      "INTERNAL_ERROR",
      "分析请求处理失败，请稍后重试。",
      500,
    );
  }
}
