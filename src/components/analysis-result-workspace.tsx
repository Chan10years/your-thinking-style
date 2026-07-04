import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";

import { AnalysisResultCodePanel } from "@/components/analysis-result-code-panel";
import type { CodeEditorHandle } from "@/components/code-editor";
import { DiagnosticDockWorkspace } from "@/components/diagnostic-dock-workspace";
import type { DiagnosticDockWorkspaceHandle } from "@/components/diagnostic-dock-workspace";
import { SupplementalSummary } from "@/components/supplemental-summary";
import { buildCodeAnnotations } from "@/lib/code-annotation-decorations";
import {
  activateErrorFromCard,
  createRedErrorClickContextFromMonaco,
  mapDecorationIdsToRedErrors,
  resolveClickedRedErrorId,
} from "@/lib/error-linkage";
import type { AnalysisInput } from "@/lib/input-validation";
import type { AnalysisResponse } from "@/types/analysis";

type AnalysisResultWorkspaceProps = {
  input: AnalysisInput;
  analysis: AnalysisResponse;
  theme: "light" | "dark";
  onBackToEditing: () => void;
  onReanalyze: () => void;
  isReanalyzing: boolean;
  reanalysisMessage?: string;
};

export function AnalysisResultWorkspace({
  input,
  analysis,
  theme,
  onBackToEditing,
  onReanalyze,
  isReanalyzing,
  reanalysisMessage = "",
}: AnalysisResultWorkspaceProps) {
  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const diagnosticDockRef = useRef<DiagnosticDockWorkspaceHandle>(null);
  const redDecorationIdMapRef = useRef<Map<string, string>>(new Map());
  const redErrorCardRefsRef = useRef<Map<string, HTMLElement>>(new Map());
  const [activeErrorState, setActiveErrorState] = useState<{
    analysis: AnalysisResponse;
    id: string | null;
  }>(() => ({ analysis, id: null }));
  const activeErrorId =
    activeErrorState.analysis === analysis ? activeErrorState.id : null;

  const annotations = useMemo(
    () => buildCodeAnnotations(input.code, analysis, activeErrorId),
    [activeErrorId, analysis, input.code],
  );

  useEffect(() => {
    redDecorationIdMapRef.current = new Map();
    redErrorCardRefsRef.current.clear();
  }, [analysis]);

  const registerRedErrorRef = useCallback(
    (errorId: string, element: HTMLElement | null) => {
      if (element) {
        redErrorCardRefsRef.current.set(errorId, element);
      } else {
        redErrorCardRefsRef.current.delete(errorId);
      }
    },
    [],
  );

  const handleRedDecorationIdsChange = useCallback(
    (redDecorationIds: string[]) => {
      redDecorationIdMapRef.current = mapDecorationIdsToRedErrors(
        annotations.redErrorLinks,
        redDecorationIds,
      );
    },
    [annotations.redErrorLinks],
  );

  const handleRedErrorCardClick = useCallback(
    (errorId: string) => {
      activateErrorFromCard(errorId, annotations.redErrorLinks, {
        setActiveErrorId: (id) => setActiveErrorState({ analysis, id }),
        setSelection: (range) => codeEditorRef.current?.setSelection(range),
        revealRangeInCenterIfOutsideViewport: (range) =>
          codeEditorRef.current?.revealRangeInCenterIfOutsideViewport(range),
        focus: () => codeEditorRef.current?.focus(),
      });
    },
    [analysis, annotations.redErrorLinks],
  );

  const handleEditorMouseDown = useCallback(
    (
      event: editor.IEditorMouseEvent,
      editorInstance: editor.IStandaloneCodeEditor,
    ) => {
        const errorId = resolveClickedRedErrorId(
          createRedErrorClickContextFromMonaco(event, editorInstance),
          annotations.redErrorLinks,
          redDecorationIdMapRef.current,
        );

        if (!errorId) {
          return;
        }

        setActiveErrorState({ analysis, id: errorId });
        diagnosticDockRef.current?.activatePanel("errorExplanation");
        window.requestAnimationFrame(() => {
          redErrorCardRefsRef.current.get(errorId)?.scrollIntoView({
            block: "center",
          });
        });
      },
    [analysis, annotations.redErrorLinks],
  );

  return (
    <div className="analysis-result-workspace" data-theme={theme}>
      <section className="workspace-panel analysis-result-problem">
        <div className="workspace-panel__header">
          <div className="workspace-panel__title">
            <span>原始题目</span>
          </div>
          <button
            type="button"
            className="analysis-result-workspace__edit"
            onClick={onBackToEditing}
            disabled={isReanalyzing}
          >
            返回编辑
          </button>
          <button
            type="button"
            className="analysis-result-workspace__reanalyze"
            onClick={onReanalyze}
            disabled={isReanalyzing}
          >
            {isReanalyzing ? "重新分析中…" : "重新分析"}
          </button>
        </div>
        <div className="analysis-result-problem__body">
          <p>{input.problem}</p>
          <SupplementalSummary input={input} />
          {reanalysisMessage ? (
            <p className="analysis-result-workspace__message" role="status">
              {reanalysisMessage}
            </p>
          ) : null}
        </div>
      </section>

      <AnalysisResultCodePanel
        code={input.code}
        theme={theme}
        annotations={annotations}
        editorRef={codeEditorRef}
        onRedDecorationIdsChange={handleRedDecorationIdsChange}
        onEditorMouseDown={handleEditorMouseDown}
      />

      <DiagnosticDockWorkspace
        ref={diagnosticDockRef}
        analysis={analysis}
        input={input}
        redErrorLocationStatuses={annotations.redErrorStatuses}
        redErrorLinks={annotations.redErrorLinks}
        activeErrorId={activeErrorId}
        onRedErrorClick={handleRedErrorCardClick}
        registerRedErrorRef={registerRedErrorRef}
      />
    </div>
  );
}
