import type { z } from "zod";

import type {
  analysisMetaSchema,
  analysisResponseSchema,
  blueBlockSchema,
  codeLocationSchema,
  fixDirectionSchema,
  newKnowledgeNeededSchema,
  personalizedPathSchema,
  redErrorSchema,
  referenceCodeSchema,
  standardPathSchema,
  suspectedIssueSchema,
  thoughtRestorationSchema,
} from "../schemas/analysis-response";

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type ThoughtRestoration = z.infer<typeof thoughtRestorationSchema>;
export type CodeLocation = z.infer<typeof codeLocationSchema>;
export type BlueBlock = z.infer<typeof blueBlockSchema>;
export type RedError = z.infer<typeof redErrorSchema>;
export type SuspectedIssue = z.infer<typeof suspectedIssueSchema>;
export type FixDirection = z.infer<typeof fixDirectionSchema>;
export type PersonalizedPath = z.infer<typeof personalizedPathSchema>;
export type StandardPath = z.infer<typeof standardPathSchema>;
export type ReferenceCode = z.infer<typeof referenceCodeSchema>;
export type NewKnowledgeNeeded = z.infer<typeof newKnowledgeNeededSchema>;
export type AnalysisMeta = z.infer<typeof analysisMetaSchema>;
