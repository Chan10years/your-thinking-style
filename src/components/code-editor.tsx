"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Editor, {
  loader,
  type BeforeMount,
  type OnMount,
} from "@monaco-editor/react";
import type { editor, IRange } from "monaco-editor";

export type CodeEditorHandle = {
  layout: () => void;
  setSelection: (range: IRange) => void;
  revealRangeInCenterIfOutsideViewport: (range: IRange) => void;
  focus: () => void;
};

type CodeEditorProps = {
  value: string;
  theme: "light" | "dark";
  onChange: (value: string) => void;
  decorations?: editor.IModelDeltaDecoration[];
  readOnly?: boolean;
  onDecorationIdsChange?: (decorationIds: string[]) => void;
  onEditorMouseDown?: (
    event: editor.IEditorMouseEvent,
    editorInstance: editor.IStandaloneCodeEditor,
  ) => void;
};

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor(
    {
      value,
      theme,
      onChange,
      decorations = [],
      readOnly = false,
      onDecorationIdsChange,
      onEditorMouseDown,
    },
    ref,
  ) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const mouseDownHandlerRef = useRef<typeof onEditorMouseDown>(undefined);
    const decorationIdsRef = useRef<string[]>([]);
    const [isMonacoReady, setIsMonacoReady] = useState(false);
    const [mountedEditor, setMountedEditor] =
      useState<editor.IStandaloneCodeEditor | null>(null);

    mouseDownHandlerRef.current = onEditorMouseDown;

    useEffect(() => {
      let isMounted = true;

      async function configureLocalMonaco() {
        const monaco = await import("monaco-editor");

        loader.config({ monaco });

        if (isMounted) {
          setIsMonacoReady(true);
        }
      }

      void configureLocalMonaco();

      return () => {
        isMounted = false;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        layout: () => editorRef.current?.layout(),
        setSelection: (range) => editorRef.current?.setSelection(range),
        revealRangeInCenterIfOutsideViewport: (range) =>
          editorRef.current?.revealRangeInCenterIfOutsideViewport(range),
        focus: () => editorRef.current?.focus(),
      }),
      [],
    );

    useEffect(() => {
      const editorInstance = editorRef.current;

      if (!editorInstance) {
        return;
      }

      decorationIdsRef.current = editorInstance.deltaDecorations(
        decorationIdsRef.current,
        decorations,
      );
      onDecorationIdsChange?.(decorationIdsRef.current);

      return () => {
        if (editorRef.current) {
          decorationIdsRef.current = editorRef.current.deltaDecorations(
            decorationIdsRef.current,
            [],
          );
          onDecorationIdsChange?.([]);
        }
      };
    }, [decorations, onDecorationIdsChange]);

    useEffect(() => {
      if (!mountedEditor) {
        return;
      }

      const disposable = mountedEditor.onMouseDown((event) => {
        mouseDownHandlerRef.current?.(event, mountedEditor);
      });

      return () => disposable.dispose();
    }, [mountedEditor]);

    const handleMount: OnMount = (editorInstance) => {
      editorRef.current = editorInstance;
      setMountedEditor(editorInstance);
      decorationIdsRef.current = editorInstance.deltaDecorations(
        decorationIdsRef.current,
        decorations,
      );
      onDecorationIdsChange?.(decorationIdsRef.current);
      editorInstance.layout();
    };

    const defineThemes: BeforeMount = (monaco) => {
      monaco.editor.defineTheme("thinking-light", {
        base: "vs",
        inherit: true,
        rules: [
          { token: "comment", foreground: "8A837D", fontStyle: "italic" },
          { token: "keyword", foreground: "322D2A" },
          { token: "number", foreground: "6C5E54" },
          { token: "string", foreground: "5C6658" },
          { token: "type.identifier", foreground: "4D5357" },
        ],
        colors: {
          "editor.background": "#FBFAF7",
          "editor.foreground": "#201C1A",
          "editorLineNumber.foreground": "#A8A19A",
          "editorLineNumber.activeForeground": "#4A4440",
          "editor.lineHighlightBackground": "#F2EFEA",
          "editor.selectionBackground": "#DDD8D1",
          "editor.inactiveSelectionBackground": "#E9E5DF",
          "editorCursor.foreground": "#171311",
          "editorIndentGuide.background1": "#E8E3DD",
          "editorIndentGuide.activeBackground1": "#CFC7BF",
          "editorWhitespace.foreground": "#DDD7D0",
        },
      });

      monaco.editor.defineTheme("thinking-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "8B8680", fontStyle: "italic" },
          { token: "keyword", foreground: "E1DDD7" },
          { token: "number", foreground: "B8AA9F" },
          { token: "string", foreground: "B4BBAE" },
          { token: "type.identifier", foreground: "C0C5C8" },
        ],
        colors: {
          "editor.background": "#171614",
          "editor.foreground": "#E9E5DF",
          "editorLineNumber.foreground": "#625E59",
          "editorLineNumber.activeForeground": "#C9C3BC",
          "editor.lineHighlightBackground": "#201F1D",
          "editor.selectionBackground": "#3A3733",
          "editor.inactiveSelectionBackground": "#2A2825",
          "editorCursor.foreground": "#F6F2EC",
          "editorIndentGuide.background1": "#292724",
          "editorIndentGuide.activeBackground1": "#494540",
          "editorWhitespace.foreground": "#34312E",
        },
      });
    };

    if (!isMonacoReady) {
      return <div className="code-editor-loading">Loading...</div>;
    }

    return (
      <Editor
        height="100%"
        language="cpp"
        value={value}
        theme={theme === "dark" ? "thinking-dark" : "thinking-light"}
        beforeMount={defineThemes}
        onMount={handleMount}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontFamily:
            '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontSize: 13,
          lineHeight: 21,
          lineNumbersMinChars: 3,
          padding: { top: 14, bottom: 18 },
          renderLineHighlight: "line",
          roundedSelection: false,
          scrollBeyondLastLine: false,
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          folding: true,
          glyphMargin: true,
          occurrencesHighlight: "off",
          selectionHighlight: false,
          wordWrap: "off",
          tabSize: 4,
          insertSpaces: true,
          readOnly,
          domReadOnly: readOnly,
          accessibilitySupport: "auto",
        }}
      />
    );
  },
);
