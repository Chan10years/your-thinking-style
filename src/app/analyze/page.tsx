"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Group,
  Panel,
  Separator,
  type Layout,
  useGroupRef,
} from "react-resizable-panels";

import { ApiKeyDialog } from "@/components/api-key-dialog";
import { AnalysisResultWorkspace } from "@/components/analysis-result-workspace";
import { BrandMark } from "@/components/brand-mark";
import {
  CodeEditor,
  type CodeEditorHandle,
} from "@/components/code-editor";
import { ThemeControl } from "@/components/theme-control";
import {
  canStartAnalysisRequest,
  requestAnalysis,
} from "@/lib/analysis-submit";
import {
  INPUT_LIMITS,
  type AnalysisInput,
  type AnalysisInputErrors,
  validateAnalysisInput,
} from "@/lib/input-validation";
import {
  DEFAULT_WORKSPACE_LAYOUT,
  FAILURE_TABS,
  parseWorkspaceLayout,
  type FailureField,
  type ThemePreference,
  type WorkspaceLayout,
  WORKSPACE_LAYOUT_STORAGE_KEY,
} from "@/lib/workspace-config";
import type { AnalysisResponse } from "@/types/analysis";

type SubmitState =
  | "idle"
  | "valid"
  | "invalid"
  | "submitting"
  | "success"
  | "error";

const emptyInput: AnalysisInput = {
  problem: "",
  code: "",
  apiKey: "",
  userThought: "",
  failureInput: "",
  expectedOutput: "",
  actualOutput: "",
};

const PANEL_IDS = {
  problem: "problem-panel",
  workspace: "workspace-panel",
  code: "code-panel",
  supplemental: "supplemental-panel",
  thought: "thought-panel",
  failure: "failure-panel",
} as const;

export default function AnalyzePage() {
  const [form, setForm] = useState<AnalysisInput>(emptyInput);
  const [errors, setErrors] = useState<AnalysisInputErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [analysisResult, setAnalysisResult] =
    useState<AnalysisResponse | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [activeFailureField, setActiveFailureField] =
    useState<FailureField>("failureInput");
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const isMobileLayout = useMediaQuery("(max-width: 760px)");
  const isCompactSupplemental = useMediaQuery("(max-width: 1080px)");
  const mainGroupRef = useGroupRef();
  const rightGroupRef = useGroupRef();
  const supplementalGroupRef = useGroupRef();
  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const analysisRequestInFlightRef = useRef(false);
  const workspaceLayoutRef = useRef<WorkspaceLayout>(
    DEFAULT_WORKSPACE_LAYOUT,
  );
  const hasRestoredLayoutRef = useRef(false);

  const layoutEditor = useCallback(() => {
    window.requestAnimationFrame(() => codeEditorRef.current?.layout());
  }, []);

  const saveWorkspaceLayout = useCallback(
    (
      section: keyof WorkspaceLayout,
      layout: Layout,
      firstId: string,
      secondId: string,
    ) => {
      const first = layout[firstId];
      const second = layout[secondId];

      if (
        typeof first !== "number" ||
        typeof second !== "number" ||
        !Number.isFinite(first) ||
        !Number.isFinite(second)
      ) {
        return;
      }

      const current = workspaceLayoutRef.current;
      const nextLayout: WorkspaceLayout =
        section === "main"
          ? {
              ...current,
              main: { problem: first, workspace: second },
            }
          : section === "right"
            ? {
                ...current,
                right: { code: first, supplemental: second },
              }
            : {
                ...current,
                supplemental: { thought: first, failure: second },
              };

      workspaceLayoutRef.current = nextLayout;

      if (hasRestoredLayoutRef.current) {
        window.localStorage.setItem(
          WORKSPACE_LAYOUT_STORAGE_KEY,
          JSON.stringify(nextLayout),
        );
      }

      layoutEditor();
    },
    [layoutEditor],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      const nextTheme =
        themePreference === "system"
          ? media.matches
            ? "dark"
            : "light"
          : themePreference;

      setResolvedTheme(nextTheme);
      document.documentElement.dataset.workspaceTheme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    }

    applyTheme();
    media.addEventListener("change", applyTheme);

    return () => media.removeEventListener("change", applyTheme);
  }, [themePreference]);

  useEffect(() => {
    const restored = parseWorkspaceLayout(
      window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY),
    );

    workspaceLayoutRef.current = restored;
    mainGroupRef.current?.setLayout({
      [PANEL_IDS.problem]: restored.main.problem,
      [PANEL_IDS.workspace]: restored.main.workspace,
    });
    rightGroupRef.current?.setLayout({
      [PANEL_IDS.code]: restored.right.code,
      [PANEL_IDS.supplemental]: restored.right.supplemental,
    });
    supplementalGroupRef.current?.setLayout({
      [PANEL_IDS.thought]: restored.supplemental.thought,
      [PANEL_IDS.failure]: restored.supplemental.failure,
    });
    hasRestoredLayoutRef.current = true;
    layoutEditor();
  }, [
    layoutEditor,
    mainGroupRef,
    rightGroupRef,
    supplementalGroupRef,
  ]);

  function updateField(field: keyof AnalysisInput, value: string) {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);

    if (submitState === "submitting") {
      return;
    }

    if (submitState !== "idle") {
      const result = validateAnalysisInput(nextForm);
      setErrors(result.errors);
      setSubmitState(result.isValid ? "valid" : "invalid");
      setServerMessage("");
      setAnalysisResult(null);
    }
  }

  async function submitCurrentAnalysis(options: { keepExistingResult: boolean }) {
    if (!canStartAnalysisRequest(analysisRequestInFlightRef.current)) {
      return;
    }

    const result = validateAnalysisInput(form);
    setErrors(result.errors);

    if (!result.isValid) {
      setSubmitState("invalid");
      setServerMessage("");

      if (result.errors.apiKey) {
        setIsApiKeyOpen(true);
      }
      return;
    }

    analysisRequestInFlightRef.current = true;
    setSubmitState("submitting");
    setServerMessage("");
    setIsReanalyzing(options.keepExistingResult);

    if (!options.keepExistingResult) {
      setAnalysisResult(null);
    }

    try {
      const submission = await requestAnalysis(form);

      if (submission.success) {
        setAnalysisResult(submission.data);
        setSubmitState("success");
        return;
      }

      setServerMessage(submission.message);
      setSubmitState("error");
    } finally {
      analysisRequestInFlightRef.current = false;
      setIsReanalyzing(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCurrentAnalysis({ keepExistingResult: Boolean(analysisResult) });
  }

  const activeFailureTab =
    FAILURE_TABS.find((tab) => tab.field === activeFailureField) ??
    FAILURE_TABS[0];

  return (
    <main className="analysis-workspace" data-theme={resolvedTheme}>
      <form onSubmit={handleSubmit} className="analysis-workspace__form">
        <header className="workspace-toolbar">
          <BrandMark compact />

          <div className="workspace-toolbar__actions">
            <button
              type="button"
              className="workspace-toolbar__text-button"
              onClick={() => setIsApiKeyOpen(true)}
            >
              <span
                className={`workspace-toolbar__status-dot ${
                  form.apiKey.trim() ? "is-ready" : ""
                }`}
              />
              API Key
            </button>

            <ThemeControl
              value={themePreference}
              onChange={setThemePreference}
            />

            <button
              type="submit"
              className="workspace-toolbar__submit"
              disabled={submitState === "submitting"}
            >
              {submitState === "submitting"
                ? analysisResult
                  ? "重新分析中…"
                  : "分析中…"
                : analysisResult
                  ? "重新分析"
                  : "开始分析"}
            </button>
          </div>
        </header>

        <div className="workspace-grid">
          {analysisResult ? (
            <AnalysisResultWorkspace
              input={form}
              analysis={analysisResult}
              theme={resolvedTheme}
              onReanalyze={() =>
                void submitCurrentAnalysis({ keepExistingResult: true })
              }
              isReanalyzing={isReanalyzing}
              reanalysisMessage={
                submitState === "error" ? serverMessage : ""
              }
              onBackToEditing={() => {
                setAnalysisResult(null);
                setSubmitState("valid");
                setServerMessage("");
              }}
            />
          ) : (
          <Group
            id="workspace-main-group"
            groupRef={mainGroupRef}
            className="workspace-main-group workspace-resizable-group"
            orientation={isMobileLayout ? "vertical" : "horizontal"}
            disabled={isMobileLayout}
            resizeTargetMinimumSize={{ fine: 8, coarse: 18 }}
            defaultLayout={{
              [PANEL_IDS.problem]: DEFAULT_WORKSPACE_LAYOUT.main.problem,
              [PANEL_IDS.workspace]: DEFAULT_WORKSPACE_LAYOUT.main.workspace,
            }}
            onLayoutChange={layoutEditor}
            onLayoutChanged={(layout) => {
              if (!isMobileLayout) {
                saveWorkspaceLayout(
                  "main",
                  layout,
                  PANEL_IDS.problem,
                  PANEL_IDS.workspace,
                );
              }
            }}
          >
          <Panel
            id={PANEL_IDS.problem}
            className="workspace-resizable-panel"
            defaultSize={`${DEFAULT_WORKSPACE_LAYOUT.main.problem}%`}
            minSize="320px"
          >
            <WorkspacePanel
              className="workspace-problem"
              title="题目描述"
              meta={`${form.problem.length}/${INPUT_LIMITS.problem}`}
              error={errors.problem}
            >
              <WorkspaceTextarea
                id="problem"
                value={form.problem}
                placeholder="粘贴题目描述、限制条件与示例"
                error={errors.problem}
                onChange={(value) => updateField("problem", value)}
              />
            </WorkspacePanel>
          </Panel>

          <Separator
            id="workspace-main-separator"
            className={`workspace-separator ${
              isMobileLayout
                ? "workspace-separator--horizontal"
                : "workspace-separator--vertical"
            }`}
            disabled={isMobileLayout}
            aria-label="调整题目与代码区域宽度"
            onDoubleClick={() =>
              mainGroupRef.current?.setLayout({
                [PANEL_IDS.problem]: DEFAULT_WORKSPACE_LAYOUT.main.problem,
                [PANEL_IDS.workspace]:
                  DEFAULT_WORKSPACE_LAYOUT.main.workspace,
              })
            }
          />

          <Panel
            id={PANEL_IDS.workspace}
            className="workspace-resizable-panel"
            defaultSize={`${DEFAULT_WORKSPACE_LAYOUT.main.workspace}%`}
            minSize="480px"
          >
            <Group
              id="workspace-right-group"
              groupRef={rightGroupRef}
              className="workspace-right workspace-resizable-group"
              orientation="vertical"
              disabled={isMobileLayout}
              resizeTargetMinimumSize={{ fine: 8, coarse: 18 }}
              defaultLayout={{
                [PANEL_IDS.code]: DEFAULT_WORKSPACE_LAYOUT.right.code,
                [PANEL_IDS.supplemental]:
                  DEFAULT_WORKSPACE_LAYOUT.right.supplemental,
              }}
              onLayoutChange={layoutEditor}
              onLayoutChanged={(layout) => {
                if (!isMobileLayout) {
                  saveWorkspaceLayout(
                    "right",
                    layout,
                    PANEL_IDS.code,
                    PANEL_IDS.supplemental,
                  );
                }
              }}
            >
              <Panel
                id={PANEL_IDS.code}
                className="workspace-resizable-panel"
                defaultSize={`${DEFAULT_WORKSPACE_LAYOUT.right.code}%`}
                minSize="260px"
              >
                <WorkspacePanel
                  className="workspace-code"
                  title="代码"
                  titleAside="C++"
                  meta={`${form.code.length}/${INPUT_LIMITS.code}`}
                  error={errors.code}
                >
                  <CodeEditor
                    ref={codeEditorRef}
                    value={form.code}
                    theme={resolvedTheme}
                    onChange={(value) => updateField("code", value)}
                  />
                </WorkspacePanel>
              </Panel>

              <Separator
                id="workspace-right-separator"
                className="workspace-separator workspace-separator--horizontal"
                disabled={isMobileLayout}
                aria-label="调整代码与补充信息区域高度"
                onDoubleClick={() =>
                  rightGroupRef.current?.setLayout({
                    [PANEL_IDS.code]: DEFAULT_WORKSPACE_LAYOUT.right.code,
                    [PANEL_IDS.supplemental]:
                      DEFAULT_WORKSPACE_LAYOUT.right.supplemental,
                  })
                }
              />

              <Panel
                id={PANEL_IDS.supplemental}
                className="workspace-resizable-panel"
                defaultSize={`${DEFAULT_WORKSPACE_LAYOUT.right.supplemental}%`}
                minSize={isCompactSupplemental ? "360px" : "180px"}
              >
                <Group
                  id="workspace-supplemental-group"
                  groupRef={supplementalGroupRef}
                  className="workspace-supplemental workspace-resizable-group"
                  orientation={
                    isCompactSupplemental ? "vertical" : "horizontal"
                  }
                  disabled={isMobileLayout}
                  resizeTargetMinimumSize={{ fine: 8, coarse: 18 }}
                  defaultLayout={{
                    [PANEL_IDS.thought]:
                      DEFAULT_WORKSPACE_LAYOUT.supplemental.thought,
                    [PANEL_IDS.failure]:
                      DEFAULT_WORKSPACE_LAYOUT.supplemental.failure,
                  }}
                  onLayoutChanged={(layout) => {
                    if (!isCompactSupplemental) {
                      saveWorkspaceLayout(
                        "supplemental",
                        layout,
                        PANEL_IDS.thought,
                        PANEL_IDS.failure,
                      );
                    }
                  }}
                >
                  <Panel
                    id={PANEL_IDS.thought}
                    className="workspace-resizable-panel"
                    defaultSize={`${DEFAULT_WORKSPACE_LAYOUT.supplemental.thought}%`}
                    minSize={isCompactSupplemental ? "180px" : "240px"}
                  >
                    <WorkspacePanel
                      className="workspace-thought"
                      title="我的思路或卡点"
                      meta={`${form.userThought.length}/${INPUT_LIMITS.userThought}`}
                      error={errors.userThought}
                    >
                      <WorkspaceTextarea
                        id="userThought"
                        value={form.userThought}
                        placeholder="从哪里开始、如何推导、目前卡在哪里"
                        error={errors.userThought}
                        onChange={(value) =>
                          updateField("userThought", value)
                        }
                      />
                    </WorkspacePanel>
                  </Panel>

                  <Separator
                    id="workspace-supplemental-separator"
                    className={`workspace-separator ${
                      isCompactSupplemental
                        ? "workspace-separator--horizontal"
                        : "workspace-separator--vertical"
                    }`}
                    disabled={isMobileLayout}
                    aria-label="调整思路与失败案例区域宽度"
                    onDoubleClick={() =>
                      supplementalGroupRef.current?.setLayout({
                        [PANEL_IDS.thought]:
                          DEFAULT_WORKSPACE_LAYOUT.supplemental.thought,
                        [PANEL_IDS.failure]:
                          DEFAULT_WORKSPACE_LAYOUT.supplemental.failure,
                      })
                    }
                  />

                  <Panel
                    id={PANEL_IDS.failure}
                    className="workspace-resizable-panel"
                    defaultSize={`${DEFAULT_WORKSPACE_LAYOUT.supplemental.failure}%`}
                    minSize={isCompactSupplemental ? "180px" : "280px"}
                  >
                    <section className="workspace-panel workspace-failure">
                      <div className="workspace-panel__header workspace-failure__header">
                        <div className="workspace-panel__title">
                          <span>失败案例</span>
                          <span className="workspace-panel__optional">
                            可选
                          </span>
                        </div>
                        <span
                          className={`workspace-panel__counter ${
                            form[activeFailureField].length >
                            activeFailureTab.limit
                              ? "is-over"
                              : ""
                          }`}
                        >
                          {form[activeFailureField].length}/
                          {activeFailureTab.limit}
                        </span>
                      </div>

                      <div
                        className="workspace-failure__tabs"
                        role="tablist"
                        aria-label="失败案例字段"
                      >
                        {FAILURE_TABS.map((tab) => (
                          <button
                            key={tab.field}
                            id={`failure-tab-${tab.field}`}
                            type="button"
                            role="tab"
                            aria-selected={activeFailureField === tab.field}
                            aria-controls={`failure-panel-${tab.field}`}
                            onClick={() =>
                              setActiveFailureField(tab.field)
                            }
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div
                        id={`failure-panel-${activeFailureField}`}
                        className="workspace-failure__content"
                        role="tabpanel"
                        aria-labelledby={`failure-tab-${activeFailureField}`}
                      >
                        <WorkspaceTextarea
                          id={activeFailureField}
                          value={form[activeFailureField]}
                          placeholder={activeFailureTab.placeholder}
                          error={errors[activeFailureField]}
                          onChange={(value) =>
                            updateField(activeFailureField, value)
                          }
                        />
                      </div>
                    </section>
                  </Panel>
                </Group>
              </Panel>
            </Group>
          </Panel>
          </Group>
          )}
        </div>

        {!analysisResult ? (
          <WorkspaceStatus
            state={submitState}
            errors={errors}
            serverMessage={serverMessage}
          />
        ) : null}
      </form>

      <ApiKeyDialog
        open={isApiKeyOpen}
        value={form.apiKey}
        error={errors.apiKey}
        onChange={(value) => updateField("apiKey", value)}
        onClose={() => setIsApiKeyOpen(false)}
      />
    </main>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const updateMatch = () => setMatches(media.matches);

    updateMatch();
    media.addEventListener("change", updateMatch);

    return () => media.removeEventListener("change", updateMatch);
  }, [query]);

  return matches;
}

function WorkspacePanel({
  className,
  title,
  titleAside,
  meta,
  error,
  children,
}: {
  className: string;
  title: string;
  titleAside?: string;
  meta: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`workspace-panel ${className}`}>
      <div className="workspace-panel__header">
        <div className="workspace-panel__title">
          <span>{title}</span>
          {titleAside ? <span>{titleAside}</span> : null}
        </div>
        <span
          className={`workspace-panel__counter ${error ? "is-over" : ""}`}
        >
          {meta}
        </span>
      </div>
      <div className="workspace-panel__body">{children}</div>
      {error ? <p className="workspace-field-error">{error}</p> : null}
    </section>
  );
}

function WorkspaceTextarea({
  id,
  value,
  placeholder,
  error,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      id={id}
      name={id}
      value={value}
      placeholder={placeholder}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      onChange={(event) => onChange(event.target.value)}
      className="workspace-textarea"
    />
  );
}

function WorkspaceStatus({
  state,
  errors,
  serverMessage,
}: {
  state: SubmitState;
  errors: AnalysisInputErrors;
  serverMessage: string;
}) {
  if (state === "idle" || state === "submitting") {
    return null;
  }

  const message =
    state === "success"
      ? "分析完成，服务端已返回通过结构校验的结果。"
      : state === "valid"
        ? "输入已通过校验，可以开始分析。"
        : state === "error"
          ? serverMessage
          : `请修正 ${Object.keys(errors).length} 项输入后再开始分析。`;

  return (
    <div
      className={`workspace-status ${
        state === "success" || state === "valid" ? "is-success" : "is-error"
      }`}
      role="status"
    >
      {message}
    </div>
  );
}
