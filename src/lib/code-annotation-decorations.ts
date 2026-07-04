import type { editor } from "monaco-editor";

import {
  locateExactCode,
} from "@/lib/code-location-resolver";
import {
  buildRedErrorLinks,
  createRedErrorDecorations,
  type RedErrorLink,
  type RedErrorLocationStatus,
} from "@/lib/error-linkage";
import type { AnalysisResponse, CodeLocation } from "@/types/analysis";

export type CodeAnnotationState = {
  blueDecorations: editor.IModelDeltaDecoration[];
  redDecorations: editor.IModelDeltaDecoration[];
  redErrorStatuses: RedErrorLocationStatus[];
  redErrorLinks: RedErrorLink[];
};

const BLUE_Z_INDEX = 10;

function toMonacoRange(range: {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}) {
  return {
    startLineNumber: range.startLine,
    startColumn: range.startColumn,
    endLineNumber: range.endLine,
    endColumn: range.endColumn,
  };
}

function createBlueDecoration(
  location: CodeLocation,
  sourceCode: string,
): editor.IModelDeltaDecoration | null {
  const located = locateExactCode(
    sourceCode,
    location.exactCode,
    location,
  );

  if (!located.success) {
    return null;
  }

  return {
    range: toMonacoRange(located.range),
    options: {
      className: "code-annotation code-annotation--blue",
      zIndex: BLUE_Z_INDEX,
      stickiness: 1,
    },
  };
}

export function buildCodeAnnotations(
  sourceCode: string,
  analysis: AnalysisResponse,
  activeErrorId: string | null = null,
): CodeAnnotationState {
  const blueDecorations = analysis.blueBlocks.flatMap((block) => {
    const decoration = createBlueDecoration(block.location, sourceCode);

    return decoration ? [decoration] : [];
  });
  const redErrorLinks = buildRedErrorLinks(sourceCode, analysis);

  return {
    blueDecorations,
    redDecorations: createRedErrorDecorations(redErrorLinks, activeErrorId),
    redErrorStatuses: redErrorLinks.map((link) => link.status),
    redErrorLinks,
  };
}

export type { RedErrorLink, RedErrorLocationStatus };
