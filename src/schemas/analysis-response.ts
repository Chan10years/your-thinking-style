import { z } from "zod";

const nonEmptyTextSchema = z.string().trim().min(1);
const positiveIntegerSchema = z.number().int().positive();

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

export const codeLocationSchema = z
  .strictObject({
    startLine: positiveIntegerSchema,
    startColumn: positiveIntegerSchema,
    endLine: positiveIntegerSchema,
    endColumn: positiveIntegerSchema,
    exactCode: z.string().min(1),
  })
  .superRefine((location, context) => {
    const endsAfterStart =
      location.endLine > location.startLine ||
      (location.endLine === location.startLine &&
        location.endColumn > location.startColumn);

    if (!endsAfterStart) {
      context.addIssue({
        code: "custom",
        path: ["endLine"],
        message: "结束位置必须严格晚于开始位置。",
      });
    }
  });

export const thoughtRestorationSchema = z.strictObject({
  status: z.enum([
    "thought_flawed",
    "implementation_bug",
    "thought_code_mismatch",
    "insufficient_information",
  ]),
  userThoughtSummary: nonEmptyTextSchema,
  codeBehaviorSummary: nonEmptyTextSchema,
  consistencyAnalysis: nonEmptyTextSchema,
  deviationPoint: z.string(),
  canBeFixedAlongOriginalThought: z.boolean(),
  reasoning: nonEmptyTextSchema,
  confidence: z.enum(["high", "medium", "low"]),
});

export const blueBlockSchema = z.strictObject({
  location: codeLocationSchema,
  reason: nonEmptyTextSchema,
});

const evidenceSourcesSchema = z
  .array(z.enum(["failure_case", "static_analysis"]))
  .min(1)
  .superRefine((sources, context) => {
    if (hasDuplicates(sources)) {
      context.addIssue({
        code: "custom",
        message: "evidenceSources 不得包含重复值。",
      });
    }
  });

export const redErrorSchema = z.strictObject({
  id: z.enum(["错误 1", "错误 2", "错误 3", "错误 4", "错误 5"]),
  location: codeLocationSchema,
  errorType: z.enum([
    "syntax_or_compile_error",
    "hard_requirement_violation",
    "boundary_case_error",
    "logic_error",
    "runtime_failure_risk",
  ]),
  evidenceLevel: z.literal("confirmed"),
  evidenceSources: evidenceSourcesSchema,
  title: nonEmptyTextSchema,
  explanation: nonEmptyTextSchema,
  runtimeConsequence: nonEmptyTextSchema,
  localFixSuggestion: nonEmptyTextSchema,
});

export const suspectedIssueSchema = z.strictObject({
  title: nonEmptyTextSchema,
  evidenceSource: z.enum([
    "failure_case",
    "static_analysis",
    "insufficient_evidence",
  ]),
  explanation: nonEmptyTextSchema,
  suggestedVerification: nonEmptyTextSchema,
});

export const referenceCodeSchema = z
  .strictObject({
    available: z.boolean(),
    codeType: z.enum(["full_code", "partial_code", "pseudocode"]),
    language: z.enum(["cpp", "pseudo"]),
    code: z.string(),
    unavailableReason: z.string(),
  })
  .superRefine((referenceCode, context) => {
    const expectedLanguage =
      referenceCode.codeType === "pseudocode" ? "pseudo" : "cpp";

    if (referenceCode.language !== expectedLanguage) {
      context.addIssue({
        code: "custom",
        path: ["language"],
        message: `${referenceCode.codeType} 必须使用 ${expectedLanguage}。`,
      });
    }

    if (referenceCode.available && referenceCode.code.trim().length === 0) {
      context.addIssue({
        code: "custom",
        path: ["code"],
        message: "提供参考代码时 code 不得为空。",
      });
    }

    if (
      !referenceCode.available &&
      referenceCode.unavailableReason.trim().length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["unavailableReason"],
        message: "不提供参考代码时必须说明原因。",
      });
    }
  });

export const personalizedPathSchema = z
  .strictObject({
    strategy: nonEmptyTextSchema,
    steps: z.array(nonEmptyTextSchema).min(1).max(6),
    keyAlgorithmOrDataStructure: nonEmptyTextSchema,
    referenceCode: referenceCodeSchema,
    achievableLevel: z.enum([
      "understanding_only",
      "partial_data",
      "full_ac_non_optimal",
      "full_ac",
    ]),
    limitations: z.array(nonEmptyTextSchema),
  })
  .superRefine((path, context) => {
    const referenceCode = path.referenceCode;

    if (
      path.achievableLevel === "full_ac" ||
      path.achievableLevel === "full_ac_non_optimal"
    ) {
      if (
        !referenceCode.available ||
        referenceCode.codeType !== "full_code" ||
        referenceCode.language !== "cpp" ||
        referenceCode.code.trim().length === 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["referenceCode"],
          message: `${path.achievableLevel} 必须提供完整、非空、可复现的 C++ 代码。`,
        });
      }
    }

    if (
      path.achievableLevel === "partial_data" &&
      (!referenceCode.available ||
        !["full_code", "partial_code"].includes(referenceCode.codeType) ||
        referenceCode.language !== "cpp" ||
        referenceCode.code.trim().length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["referenceCode"],
        message: "partial_data 必须提供完整或局部的非空 C++ 代码。",
      });
    }

    if (
      path.achievableLevel !== "understanding_only" &&
      !referenceCode.available
    ) {
      context.addIssue({
        code: "custom",
        path: ["referenceCode", "available"],
        message: "只有 understanding_only 允许不提供参考代码。",
      });
    }
  });

const standardReferenceCodeSchema = referenceCodeSchema.superRefine(
  (referenceCode, context) => {
    if (
      !referenceCode.available ||
      referenceCode.codeType !== "full_code" ||
      referenceCode.language !== "cpp" ||
      referenceCode.code.trim().length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "standardPath 必须提供完整、非空、可复现的 C++ 代码。",
      });
    }
  },
);

export const standardPathSchema = z.strictObject({
  strategy: nonEmptyTextSchema,
  steps: z.array(nonEmptyTextSchema).min(1).max(6),
  keyAlgorithmOrDataStructure: nonEmptyTextSchema,
  referenceCode: standardReferenceCodeSchema,
  advantagesOverPersonalizedPath: z.array(nonEmptyTextSchema),
});

const usedInPathSchema = z
  .array(z.enum(["personalizedPath", "standardPath"]))
  .min(1)
  .superRefine((paths, context) => {
    if (hasDuplicates(paths)) {
      context.addIssue({
        code: "custom",
        message: "usedInPath 不得包含重复值。",
      });
    }
  });

export const newKnowledgeNeededSchema = z.strictObject({
  topic: nonEmptyTextSchema,
  whyNeeded: nonEmptyTextSchema,
  usedInPath: usedInPathSchema,
  minimumExplanation: nonEmptyTextSchema,
});

export const fixDirectionSchema = z.strictObject({
  personalizedPath: personalizedPathSchema,
  standardPath: standardPathSchema,
  newKnowledgeNeeded: z
    .array(newKnowledgeNeededSchema)
    .max(5)
    .superRefine((items, context) => {
      const topics = items.map((item) => item.topic.trim());
      if (hasDuplicates(topics)) {
        context.addIssue({
          code: "custom",
          message: "newKnowledgeNeeded.topic 不得重复。",
        });
      }
    }),
});

const analysisBasisSchema = z
  .array(z.enum(["problem", "code", "user_thought", "failure_case"]))
  .min(1)
  .superRefine((basis, context) => {
    if (hasDuplicates(basis)) {
      context.addIssue({
        code: "custom",
        message: "analysisBasis 不得包含重复值。",
      });
    }
  });

export const analysisMetaSchema = z.strictObject({
  analysisBasis: analysisBasisSchema,
  limitations: z.array(nonEmptyTextSchema),
  needsUserVerification: z.boolean(),
});

const redErrorsSchema = z
  .array(redErrorSchema)
  .max(5)
  .superRefine((errors, context) => {
    errors.forEach((error, index) => {
      const expectedId = `错误 ${index + 1}`;
      if (error.id !== expectedId) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `redErrors[${index}].id 必须为 ${expectedId}。`,
        });
      }
    });
  });

export const analysisResponseSchema = z
  .strictObject({
    schemaVersion: z.literal("mvp-1"),
    thoughtRestoration: thoughtRestorationSchema,
    blueBlocks: z.array(blueBlockSchema).max(3),
    redErrors: redErrorsSchema,
    redErrorsUnavailableReason: z.string(),
    suspectedIssues: z.array(suspectedIssueSchema),
    fixDirection: fixDirectionSchema,
    meta: analysisMetaSchema,
  })
  .superRefine((response, context) => {
    if (
      response.thoughtRestoration.status === "implementation_bug" &&
      response.redErrors.length === 0 &&
      response.redErrorsUnavailableReason.trim().length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["redErrorsUnavailableReason"],
        message:
          "implementation_bug 无法定位红色错误时，必须提供不可用原因。",
      });
    }
  });
