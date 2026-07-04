"use client";

import {
  DragEvent,
  forwardRef,
  ReactNode,
  useImperativeHandle,
  useState,
} from "react";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";

import { ErrorExplanationPanel } from "@/components/diagnostic-panels/error-explanation-panel";
import { FixDirectionPanel } from "@/components/diagnostic-panels/fix-direction-panel";
import { ThoughtRestorationPanel } from "@/components/diagnostic-panels/thought-restoration-panel";
import {
  activateDiagnosticPanel,
  createDefaultDiagnosticDockLayout,
  DIAGNOSTIC_PANEL_IDS,
  type DiagnosticDockDirection,
  type DiagnosticDockNode,
  type DiagnosticDockTabsNode,
  type DiagnosticPanelId,
  getDiagnosticPanelLabel,
  mergeDiagnosticPanelIntoGroup,
  moveDiagnosticPanelToDirection,
  moveDiagnosticTabWithinGroup,
  resizeDiagnosticSplit,
  setDiagnosticActiveTab,
} from "@/lib/diagnostic-dock-layout";
import type { RedErrorLocationStatus } from "@/lib/code-annotation-decorations";
import type { AnalysisInput } from "@/lib/input-validation";
import type { AnalysisResponse } from "@/types/analysis";
import type { RedErrorLink } from "@/lib/error-linkage";

type DiagnosticDockWorkspaceProps = {
  analysis: AnalysisResponse;
  input: AnalysisInput;
  redErrorLocationStatuses?: RedErrorLocationStatus[];
  redErrorLinks?: RedErrorLink[];
  activeErrorId?: string | null;
  onRedErrorClick?: (errorId: string) => void;
  registerRedErrorRef?: (errorId: string, element: HTMLElement | null) => void;
};

export type DiagnosticDockWorkspaceHandle = {
  activatePanel: (panelId: DiagnosticPanelId) => void;
};

type DockRendererProps = {
  node: DiagnosticDockNode;
  nodeId: string;
  analysis: AnalysisResponse;
  input: AnalysisInput;
  redErrorLocationStatuses: RedErrorLocationStatus[];
  redErrorLinks: RedErrorLink[];
  activeErrorId: string | null;
  onRedErrorClick?: (errorId: string) => void;
  registerRedErrorRef?: (errorId: string, element: HTMLElement | null) => void;
  draggingPanel: DiagnosticPanelId | null;
  onActivateTab: (groupId: string, panelId: DiagnosticPanelId) => void;
  onDragStart: (
    event: DragEvent<HTMLButtonElement>,
    panelId: DiagnosticPanelId,
  ) => void;
  onDragEnd: () => void;
  onTabDrop: (
    event: DragEvent<HTMLElement>,
    groupId: string,
    targetPanelId: DiagnosticPanelId,
  ) => void;
  onGroupDrop: (event: DragEvent<HTMLElement>, groupId: string) => void;
  onDirectionDrop: (
    event: DragEvent<HTMLElement>,
    targetPanelId: DiagnosticPanelId,
    direction: DiagnosticDockDirection,
  ) => void;
  onSplitResize: (splitId: string, sizes: [number, number]) => void;
};

function isDiagnosticPanelId(value: string): value is DiagnosticPanelId {
  return DIAGNOSTIC_PANEL_IDS.includes(value as DiagnosticPanelId);
}

function getDraggedPanelId(
  event: DragEvent<HTMLElement>,
): DiagnosticPanelId | null {
  const value =
    event.dataTransfer.getData("application/x-diagnostic-panel") ||
    event.dataTransfer.getData("text/plain");

  return isDiagnosticPanelId(value) ? value : null;
}

function findTabsNode(
  node: DiagnosticDockNode,
  groupId: string,
  currentId = "root",
): DiagnosticDockTabsNode | null {
  if (node.type === "tabs") {
    return currentId === groupId ? node : null;
  }

  return (
    findTabsNode(node.first, groupId, `${currentId}-first`) ??
    findTabsNode(node.second, groupId, `${currentId}-second`)
  );
}

function renderPanelContent(
  panelId: DiagnosticPanelId,
  analysis: AnalysisResponse,
  input: AnalysisInput,
  redErrorLocationStatuses: RedErrorLocationStatus[],
  redErrorLinks: RedErrorLink[],
  activeErrorId: string | null,
  onRedErrorClick?: (errorId: string) => void,
  registerRedErrorRef?: (errorId: string, element: HTMLElement | null) => void,
): ReactNode {
  if (panelId === "thoughtRestoration") {
    return (
      <ThoughtRestorationPanel
        thoughtRestoration={analysis.thoughtRestoration}
        userThought={input.userThought}
      />
    );
  }

  if (panelId === "errorExplanation") {
    return (
      <ErrorExplanationPanel
        redErrors={analysis.redErrors}
        redErrorsUnavailableReason={analysis.redErrorsUnavailableReason}
        suspectedIssues={analysis.suspectedIssues}
        redErrorLocationStatuses={redErrorLocationStatuses}
        redErrorLinks={redErrorLinks}
        activeErrorId={activeErrorId}
        onRedErrorClick={onRedErrorClick}
        registerRedErrorRef={registerRedErrorRef}
      />
    );
  }

  return <FixDirectionPanel fixDirection={analysis.fixDirection} />;
}

function allowDrop(event: DragEvent<HTMLElement>) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function DockNodeRenderer({
  node,
  nodeId,
  analysis,
  input,
  redErrorLocationStatuses,
  redErrorLinks,
  activeErrorId,
  onRedErrorClick,
  registerRedErrorRef,
  draggingPanel,
  onActivateTab,
  onDragStart,
  onDragEnd,
  onTabDrop,
  onGroupDrop,
  onDirectionDrop,
  onSplitResize,
}: DockRendererProps) {
  if (node.type === "tabs") {
    const activeTab = node.tabs.includes(node.activeTab)
      ? node.activeTab
      : node.tabs[0];

    return (
      <section
        className={`diagnostic-dock-group ${
          draggingPanel ? "is-dragging" : ""
        }`}
        data-dock-group={nodeId}
      >
        <div
          className="diagnostic-dock-tabs"
          role="tablist"
          aria-label="AI 诊断模块"
        >
          {node.tabs.map((panelId) => (
            <button
              key={panelId}
              type="button"
              draggable
              className="diagnostic-dock-tab"
              role="tab"
              aria-selected={activeTab === panelId}
              aria-controls={`diagnostic-dock-panel-${nodeId}-${panelId}`}
              onClick={() => onActivateTab(nodeId, panelId)}
              onDragStart={(event) => onDragStart(event, panelId)}
              onDragEnd={onDragEnd}
              onDragOver={allowDrop}
              onDrop={(event) => onTabDrop(event, nodeId, panelId)}
            >
              {getDiagnosticPanelLabel(panelId)}
            </button>
          ))}
        </div>

        <div className="diagnostic-dock-content">
          {draggingPanel ? (
            <div className="diagnostic-dock-drop-zones" aria-hidden="true">
              <div
                className="diagnostic-dock-drop-zone diagnostic-dock-drop-zone--top"
                onDragOver={allowDrop}
                onDrop={(event) => onDirectionDrop(event, activeTab, "top")}
              >
                <span>上方分栏</span>
              </div>
              <div
                className="diagnostic-dock-drop-zone diagnostic-dock-drop-zone--right"
                onDragOver={allowDrop}
                onDrop={(event) => onDirectionDrop(event, activeTab, "right")}
              >
                <span>右侧分栏</span>
              </div>
              <div
                className="diagnostic-dock-drop-zone diagnostic-dock-drop-zone--bottom"
                onDragOver={allowDrop}
                onDrop={(event) => onDirectionDrop(event, activeTab, "bottom")}
              >
                <span>下方分栏</span>
              </div>
              <div
                className="diagnostic-dock-drop-zone diagnostic-dock-drop-zone--left"
                onDragOver={allowDrop}
                onDrop={(event) => onDirectionDrop(event, activeTab, "left")}
              >
                <span>左侧分栏</span>
              </div>
              <div
                className="diagnostic-dock-drop-zone diagnostic-dock-drop-zone--center"
                onDragOver={allowDrop}
                onDrop={(event) => onGroupDrop(event, nodeId)}
              >
                <span>合并标签组</span>
              </div>
            </div>
          ) : null}

          <div
            id={`diagnostic-dock-panel-${nodeId}-${activeTab}`}
            className="diagnostic-dock-panel"
            role="tabpanel"
          >
            {renderPanelContent(
              activeTab,
              analysis,
              input,
              redErrorLocationStatuses,
              redErrorLinks,
              activeErrorId,
              onRedErrorClick,
              registerRedErrorRef,
            )}
          </div>
        </div>
      </section>
    );
  }

  const firstPanelId = `${nodeId}-first`;
  const secondPanelId = `${nodeId}-second`;

  return (
    <Group
      id={`diagnostic-dock-group-${nodeId}`}
      className="diagnostic-dock-split"
      orientation={node.orientation}
      resizeTargetMinimumSize={{ fine: 8, coarse: 18 }}
      defaultLayout={{
        [firstPanelId]: node.sizes[0],
        [secondPanelId]: node.sizes[1],
      }}
      onLayoutChanged={(layout: Layout) => {
        const first = layout[firstPanelId];
        const second = layout[secondPanelId];

        if (typeof first === "number" && typeof second === "number") {
          onSplitResize(nodeId, [first, second]);
        }
      }}
    >
      <Panel
        id={firstPanelId}
        className="diagnostic-dock-split__panel"
        defaultSize={`${node.sizes[0]}%`}
        minSize="120px"
      >
        <DockNodeRenderer
          node={node.first}
          nodeId={firstPanelId}
          analysis={analysis}
          input={input}
          redErrorLocationStatuses={redErrorLocationStatuses}
          redErrorLinks={redErrorLinks}
          activeErrorId={activeErrorId}
          onRedErrorClick={onRedErrorClick}
          registerRedErrorRef={registerRedErrorRef}
          draggingPanel={draggingPanel}
          onActivateTab={onActivateTab}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onTabDrop={onTabDrop}
          onGroupDrop={onGroupDrop}
          onDirectionDrop={onDirectionDrop}
          onSplitResize={onSplitResize}
        />
      </Panel>

      <Separator
        id={`diagnostic-dock-separator-${nodeId}`}
        className={`workspace-separator diagnostic-dock-separator ${
          node.orientation === "horizontal"
            ? "workspace-separator--vertical"
            : "workspace-separator--horizontal"
        }`}
        aria-label="调整诊断分栏尺寸"
      />

      <Panel
        id={secondPanelId}
        className="diagnostic-dock-split__panel"
        defaultSize={`${node.sizes[1]}%`}
        minSize="120px"
      >
        <DockNodeRenderer
          node={node.second}
          nodeId={secondPanelId}
          analysis={analysis}
          input={input}
          redErrorLocationStatuses={redErrorLocationStatuses}
          redErrorLinks={redErrorLinks}
          activeErrorId={activeErrorId}
          onRedErrorClick={onRedErrorClick}
          registerRedErrorRef={registerRedErrorRef}
          draggingPanel={draggingPanel}
          onActivateTab={onActivateTab}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onTabDrop={onTabDrop}
          onGroupDrop={onGroupDrop}
          onDirectionDrop={onDirectionDrop}
          onSplitResize={onSplitResize}
        />
      </Panel>
    </Group>
  );
}

export const DiagnosticDockWorkspace = forwardRef<
  DiagnosticDockWorkspaceHandle,
  DiagnosticDockWorkspaceProps
>(function DiagnosticDockWorkspace(
  {
    analysis,
    input,
    redErrorLocationStatuses = [],
    redErrorLinks = [],
    activeErrorId = null,
    onRedErrorClick,
    registerRedErrorRef,
  },
  ref,
) {
  const [layout, setLayout] = useState<DiagnosticDockNode>(() =>
    createDefaultDiagnosticDockLayout(),
  );
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [draggingPanel, setDraggingPanel] =
    useState<DiagnosticPanelId | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      activatePanel: (panelId) =>
        setLayout((current) => activateDiagnosticPanel(current, panelId)),
    }),
    [],
  );

  function resetLayout() {
    setLayout(createDefaultDiagnosticDockLayout());
    setLayoutVersion((version) => version + 1);
  }

  function handleActivateTab(groupId: string, panelId: DiagnosticPanelId) {
    setLayout((current) => setDiagnosticActiveTab(current, groupId, panelId));
  }

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    panelId: DiagnosticPanelId,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-diagnostic-panel", panelId);
    event.dataTransfer.setData("text/plain", panelId);
    setDraggingPanel(panelId);
  }

  function handleTabDrop(
    event: DragEvent<HTMLElement>,
    groupId: string,
    targetPanelId: DiagnosticPanelId,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const panelId = getDraggedPanelId(event);

    if (!panelId) {
      return;
    }

    setLayout((current) => {
      const group = findTabsNode(current, groupId);

      if (group?.tabs.includes(panelId)) {
        return moveDiagnosticTabWithinGroup(
          current,
          groupId,
          panelId,
          targetPanelId,
        );
      }

      return mergeDiagnosticPanelIntoGroup(current, panelId, groupId);
    });
    setDraggingPanel(null);
  }

  function handleGroupDrop(event: DragEvent<HTMLElement>, groupId: string) {
    event.preventDefault();
    event.stopPropagation();

    const panelId = getDraggedPanelId(event);

    if (!panelId) {
      return;
    }

    setLayout((current) =>
      mergeDiagnosticPanelIntoGroup(current, panelId, groupId),
    );
    setDraggingPanel(null);
  }

  function handleDirectionDrop(
    event: DragEvent<HTMLElement>,
    targetPanelId: DiagnosticPanelId,
    direction: DiagnosticDockDirection,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const panelId = getDraggedPanelId(event);

    if (!panelId) {
      return;
    }

    setLayout((current) =>
      moveDiagnosticPanelToDirection(
        current,
        panelId,
        targetPanelId,
        direction,
      ),
    );
    setLayoutVersion((version) => version + 1);
    setDraggingPanel(null);
  }

  function handleSplitResize(splitId: string, sizes: [number, number]) {
    setLayout((current) => resizeDiagnosticSplit(current, splitId, sizes));
  }

  return (
    <section className="workspace-panel analysis-diagnostic-workspace">
      <div className="workspace-panel__header">
        <div className="workspace-panel__title">
          <span>AI 诊断工作区</span>
          <span>5B</span>
        </div>
        <button
          type="button"
          className="diagnostic-dock-reset"
          onClick={resetLayout}
        >
          恢复默认布局
        </button>
      </div>

      <div className="diagnostic-dock" key={layoutVersion}>
        <DockNodeRenderer
          node={layout}
          nodeId="root"
          analysis={analysis}
          input={input}
          redErrorLocationStatuses={redErrorLocationStatuses}
          redErrorLinks={redErrorLinks}
          activeErrorId={activeErrorId}
          onRedErrorClick={onRedErrorClick}
          registerRedErrorRef={registerRedErrorRef}
          draggingPanel={draggingPanel}
          onActivateTab={handleActivateTab}
          onDragStart={handleDragStart}
          onDragEnd={() => setDraggingPanel(null)}
          onTabDrop={handleTabDrop}
          onGroupDrop={handleGroupDrop}
          onDirectionDrop={handleDirectionDrop}
          onSplitResize={handleSplitResize}
        />
      </div>
    </section>
  );
});
