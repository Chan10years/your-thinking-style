import type { Ref } from "react";
import type { editor } from "monaco-editor";

import { CodeEditor, type CodeEditorHandle } from "@/components/code-editor";
import type { CodeAnnotationState } from "@/lib/code-annotation-decorations";

type AnalysisResultCodePanelProps = {
  code: string;
  theme: "light" | "dark";
  annotations: CodeAnnotationState;
  editorRef?: Ref<CodeEditorHandle>;
  onRedDecorationIdsChange?: (redDecorationIds: string[]) => void;
  onEditorMouseDown?: (
    event: editor.IEditorMouseEvent,
    editorInstance: editor.IStandaloneCodeEditor,
  ) => void;
};

export function AnalysisResultCodePanel({
  code,
  theme,
  annotations,
  editorRef,
  onRedDecorationIdsChange,
  onEditorMouseDown,
}: AnalysisResultCodePanelProps) {
  const blueDecorationCount = annotations.blueDecorations.length;

  return (
    <section className="workspace-panel analysis-result-code">
      <div className="workspace-panel__header">
        <div className="workspace-panel__title">
          <span>用户代码</span>
          <span>C++</span>
        </div>
        <span className="workspace-panel__counter">{code.length} 字符</span>
      </div>
      <div className="analysis-result-code__body">
        <CodeEditor
          ref={editorRef}
          value={code}
          theme={theme}
          readOnly
          decorations={[
            ...annotations.blueDecorations,
            ...annotations.redDecorations,
          ]}
          onDecorationIdsChange={(decorationIds) =>
            onRedDecorationIdsChange?.(
              decorationIds.slice(blueDecorationCount),
            )
          }
          onEditorMouseDown={onEditorMouseDown}
          onChange={() => {}}
        />
      </div>
    </section>
  );
}
