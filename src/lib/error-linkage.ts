import type { editor } from "monaco-editor";

import {
  locateExactCode,
  type CodeLocationResult,
} from "@/lib/code-location-resolver";
import type { AnalysisResponse, RedError } from "@/types/analysis";

type FailedCodeLocationResult = Extract<
  CodeLocationResult,
  { success: false }
>;

export type MonacoRangeLike = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type RedErrorLocationStatus = {
  id: string;
  located: boolean;
  label: string;
  reason?: FailedCodeLocationResult["reason"];
};

export type RedErrorLink = {
  id: string;
  error: RedError;
  range: MonacoRangeLike | null;
  status: RedErrorLocationStatus;
};

export type ErrorCardActivationTarget = {
  setActiveErrorId: (errorId: string) => void;
  setSelection: (range: MonacoRangeLike) => void;
  revealRangeInCenterIfOutsideViewport: (range: MonacoRangeLike) => void;
  focus: () => void;
};

export type RedErrorClickDecoration = {
  id: string;
  range?: MonacoRangeLike | null;
};

export type RedErrorClickContext = {
  targetDecorationId?: string | null;
  position?: { lineNumber: number; column: number } | null;
  lineDecorations?: RedErrorClickDecoration[];
};

const RED_Z_INDEX = 20;

function toMonacoRange(range: {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}): MonacoRangeLike {
  return {
    startLineNumber: range.startLine,
    startColumn: range.startColumn,
    endLineNumber: range.endLine,
    endColumn: range.endColumn,
  };
}

function getErrorNumber(errorId: string, fallbackIndex: number) {
  const match = /^错误\s+(\d+)$/.exec(errorId);

  return match?.[1] ?? String(fallbackIndex + 1);
}

function createLifecycleStableErrorId(error: RedError, index: number) {
  if (error.id.trim().length > 0) {
    return error.id;
  }

  const source = [
    error.title,
    error.errorType,
    error.location.exactCode,
    error.explanation,
  ].join("|");
  let hash = 0;

  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }

  return `generated-error-${hash.toString(36)}-${index + 1}`;
}

function containsPosition(
  range: MonacoRangeLike,
  position: { lineNumber: number; column: number },
) {
  const afterStart =
    position.lineNumber > range.startLineNumber ||
    (position.lineNumber === range.startLineNumber &&
      position.column >= range.startColumn);
  const beforeEnd =
    position.lineNumber < range.endLineNumber ||
    (position.lineNumber === range.endLineNumber &&
      position.column < range.endColumn);

  return afterStart && beforeEnd;
}

function getTargetDecorationId(target: unknown): string | null {
  if (typeof target !== "object" || target === null) {
    return null;
  }

  const detail =
    "detail" in target && typeof target.detail === "object"
      ? target.detail
      : null;

  if (detail && "decorationId" in detail && typeof detail.decorationId === "string") {
    return detail.decorationId;
  }

  if (
    detail &&
    "glyphMargin" in detail &&
    typeof detail.glyphMargin === "object" &&
    detail.glyphMargin !== null &&
    "decorationId" in detail.glyphMargin &&
    typeof detail.glyphMargin.decorationId === "string"
  ) {
    return detail.glyphMargin.decorationId;
  }

  return null;
}

export function buildRedErrorLinks(
  sourceCode: string,
  analysis: AnalysisResponse,
): RedErrorLink[] {
  return analysis.redErrors.map((error, index) => {
    const id = createLifecycleStableErrorId(error, index);
    const located = locateExactCode(
      sourceCode,
      error.location.exactCode,
      error.location,
    );

    if (!located.success) {
      return {
        id,
        error,
        range: null,
        status: {
          id,
          located: false,
          label: "代码位置未能可靠定位",
          reason: located.reason,
        },
      };
    }

    return {
      id,
      error,
      range: toMonacoRange(located.range),
      status: {
        id,
        located: true,
        label: "已定位代码位置",
      },
    };
  });
}

export function createRedErrorDecorations(
  links: RedErrorLink[],
  activeErrorId: string | null,
): editor.IModelDeltaDecoration[] {
  return links.flatMap((link, index) => {
    if (!link.range) {
      return [];
    }

    const isActive = link.id === activeErrorId;
    const className = isActive
      ? "code-annotation code-annotation--red code-annotation--red-active"
      : "code-annotation code-annotation--red";

    return [
      {
        range: link.range,
        options: {
          description: `red-error:${link.id}`,
          className,
          glyphMarginClassName: isActive
            ? "code-annotation-glyph code-annotation-glyph--red code-annotation-glyph--red-active"
            : "code-annotation-glyph code-annotation-glyph--red",
          glyphMarginHoverMessage: { value: link.error.id || link.id },
          before: {
            content: getErrorNumber(link.error.id || link.id, index),
            inlineClassName: isActive
              ? "code-annotation-badge code-annotation-badge--red code-annotation-badge--red-active"
              : "code-annotation-badge code-annotation-badge--red",
          },
          zIndex: RED_Z_INDEX,
          stickiness: 1,
        },
      },
    ];
  });
}

export function mapDecorationIdsToRedErrors(
  links: RedErrorLink[],
  redDecorationIds: string[],
) {
  const result = new Map<string, string>();
  const locatedLinks = links.filter((link) => link.range !== null);

  redDecorationIds.forEach((decorationId, index) => {
    const link = locatedLinks[index];

    if (link) {
      result.set(decorationId, link.id);
    }
  });

  return result;
}

export function activateErrorFromCard(
  errorId: string,
  links: RedErrorLink[],
  target: ErrorCardActivationTarget,
) {
  target.setActiveErrorId(errorId);

  const link = links.find((candidate) => candidate.id === errorId);

  if (!link?.range) {
    return false;
  }

  target.setSelection(link.range);
  target.revealRangeInCenterIfOutsideViewport(link.range);
  target.focus();

  return true;
}

export function resolveClickedRedErrorId(
  context: RedErrorClickContext,
  links: RedErrorLink[],
  decorationIdToErrorId: Map<string, string>,
): string | null {
  const targetDecorationId = context.targetDecorationId ?? null;

  if (targetDecorationId) {
    const linkedId = decorationIdToErrorId.get(targetDecorationId);

    if (linkedId) {
      return linkedId;
    }
  }

  if (!context.position) {
    return null;
  }

  const matchingDecoration = context.lineDecorations?.find((decoration) => {
    const linkedId = decorationIdToErrorId.get(decoration.id);

    return (
      linkedId !== undefined &&
      decoration.range !== null &&
      decoration.range !== undefined &&
      containsPosition(decoration.range, context.position!)
    );
  });

  if (matchingDecoration) {
    return decorationIdToErrorId.get(matchingDecoration.id) ?? null;
  }

  const matchingLink = links.find(
    (link) =>
      link.range !== null && containsPosition(link.range, context.position!),
  );

  return matchingLink?.id ?? null;
}

export function createRedErrorClickContextFromMonaco(
  event: editor.IEditorMouseEvent,
  editorInstance: editor.IStandaloneCodeEditor,
): RedErrorClickContext {
  const position = event.target.position
    ? {
        lineNumber: event.target.position.lineNumber,
        column: event.target.position.column,
      }
    : null;
  const lineDecorations = position
    ? editorInstance.getLineDecorations(position.lineNumber)?.map((decoration) => ({
        id: decoration.id,
        range: decoration.range,
      })) ?? []
    : [];

  return {
    targetDecorationId: getTargetDecorationId(event.target),
    position,
    lineDecorations,
  };
}
