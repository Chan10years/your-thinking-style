import type { CodeLocation } from "@/types/analysis";

export type CodeLocationHint = Pick<
  CodeLocation,
  "startLine" | "startColumn" | "endLine" | "endColumn"
>;

export type ResolvedCodeRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type CodeLocationFailureReason =
  | "empty_exact_code"
  | "no_match"
  | "ambiguous_match"
  | "invalid_range";

export type CodeLocationResult =
  | {
      success: true;
      range: ResolvedCodeRange;
      startOffset: number;
      endOffset: number;
    }
  | {
      success: false;
      reason: CodeLocationFailureReason;
      message: string;
    };

type SourceLine = {
  lineNumber: number;
  startOffset: number;
  contentEndOffset: number;
};

type SourcePosition = {
  line: SourceLine;
  column: number;
};

type MatchCandidate = {
  startOffset: number;
  endOffset: number;
  range: ResolvedCodeRange;
};

function splitSourceLines(sourceCode: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let lineStart = 0;

  for (let index = 0; index < sourceCode.length; index += 1) {
    if (sourceCode[index] === "\r" && sourceCode[index + 1] === "\n") {
      lines.push({
        lineNumber: lines.length + 1,
        startOffset: lineStart,
        contentEndOffset: index,
      });
      index += 1;
      lineStart = index + 1;
    } else if (sourceCode[index] === "\n") {
      lines.push({
        lineNumber: lines.length + 1,
        startOffset: lineStart,
        contentEndOffset: index,
      });
      lineStart = index + 1;
    }
  }

  lines.push({
    lineNumber: lines.length + 1,
    startOffset: lineStart,
    contentEndOffset: sourceCode.length,
  });

  return lines;
}

function findLineForOffset(
  lines: SourceLine[],
  offset: number,
): SourceLine | null {
  let low = 0;
  let high = lines.length - 1;
  let found: SourceLine | null = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const line = lines[middle];

    if (line.startOffset <= offset) {
      found = line;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return found;
}

function offsetToPosition(
  lines: SourceLine[],
  offset: number,
): SourcePosition | null {
  if (offset < 0) {
    return null;
  }

  const line = findLineForOffset(lines, offset);

  if (!line) {
    return null;
  }

  return {
    line,
    column: offset - line.startOffset + 1,
  };
}

function isValidRange(
  lines: SourceLine[],
  range: ResolvedCodeRange,
): boolean {
  const startLine = lines[range.startLine - 1];
  const endLine = lines[range.endLine - 1];

  if (!startLine || !endLine) {
    return false;
  }

  const startLineLength = startLine.contentEndOffset - startLine.startOffset;
  const endLineLength = endLine.contentEndOffset - endLine.startOffset;
  const startsWithinLine = range.startColumn <= startLineLength + 1;
  const endsWithinLine = range.endColumn <= endLineLength + 1;
  const endsAfterStart =
    range.endLine > range.startLine ||
    (range.endLine === range.startLine &&
      range.endColumn > range.startColumn);

  return startsWithinLine && endsWithinLine && endsAfterStart;
}

function createCandidate(
  lines: SourceLine[],
  startOffset: number,
  endOffset: number,
): MatchCandidate | null {
  const start = offsetToPosition(lines, startOffset);
  const end = offsetToPosition(lines, endOffset);

  if (!start || !end) {
    return null;
  }

  const range = {
    startLine: start.line.lineNumber,
    startColumn: start.column,
    endLine: end.line.lineNumber,
    endColumn: end.column,
  };

  if (!isValidRange(lines, range)) {
    return null;
  }

  return {
    startOffset,
    endOffset,
    range,
  };
}

function findAllMatches(sourceCode: string, exactCode: string) {
  const matches: number[] = [];
  let start = 0;

  while (start <= sourceCode.length) {
    const index = sourceCode.indexOf(exactCode, start);

    if (index === -1) {
      break;
    }

    matches.push(index);
    start = index + 1;
  }

  return matches;
}

function hasUsableHint(hint?: CodeLocationHint): hint is CodeLocationHint {
  return (
    hint !== undefined &&
    Number.isFinite(hint.startLine) &&
    Number.isFinite(hint.startColumn) &&
    hint.startLine >= 1 &&
    hint.startColumn >= 1
  );
}

function getHintDistance(candidate: MatchCandidate, hint: CodeLocationHint) {
  const lineDistance = Math.abs(candidate.range.startLine - hint.startLine);
  const columnDistance = Math.abs(
    candidate.range.startColumn - hint.startColumn,
  );

  return lineDistance * 1_000_000 + columnDistance;
}

function selectNearestCandidate(
  candidates: MatchCandidate[],
  hint?: CodeLocationHint,
): MatchCandidate | null {
  if (!hasUsableHint(hint)) {
    return null;
  }

  let bestCandidate = candidates[0];
  let bestDistance = getHintDistance(bestCandidate, hint);
  let tied = false;

  for (const candidate of candidates.slice(1)) {
    const distance = getHintDistance(candidate, hint);

    if (distance < bestDistance) {
      bestCandidate = candidate;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance) {
      tied = true;
    }
  }

  return tied ? null : bestCandidate;
}

export function locateExactCode(
  sourceCode: string,
  exactCode: string,
  hint?: CodeLocationHint,
): CodeLocationResult {
  if (exactCode.length === 0) {
    return {
      success: false,
      reason: "empty_exact_code",
      message: "exactCode 为空，无法可靠定位。",
    };
  }

  const lines = splitSourceLines(sourceCode);
  const candidates = findAllMatches(sourceCode, exactCode)
    .map((startOffset) =>
      createCandidate(lines, startOffset, startOffset + exactCode.length),
    )
    .filter((candidate): candidate is MatchCandidate => candidate !== null);

  if (candidates.length === 0) {
    return {
      success: false,
      reason: "no_match",
      message: "exactCode 未在用户原始代码中完全匹配。",
    };
  }

  if (candidates.length === 1) {
    const candidate = candidates[0];

    return {
      success: true,
      range: candidate.range,
      startOffset: candidate.startOffset,
      endOffset: candidate.endOffset,
    };
  }

  const selected = selectNearestCandidate(candidates, hint);

  if (!selected) {
    return {
      success: false,
      reason: "ambiguous_match",
      message: "exactCode 出现多次，无法通过模型位置提示可靠消歧。",
    };
  }

  return {
    success: true,
    range: selected.range,
    startOffset: selected.startOffset,
    endOffset: selected.endOffset,
  };
}
