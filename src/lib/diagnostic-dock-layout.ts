export const DIAGNOSTIC_PANEL_IDS = [
  "thoughtRestoration",
  "errorExplanation",
  "fixDirection",
] as const;

export type DiagnosticPanelId = (typeof DIAGNOSTIC_PANEL_IDS)[number];
export type DiagnosticDockDirection = "top" | "right" | "bottom" | "left";

export type DiagnosticDockTabsNode = {
  type: "tabs";
  tabs: DiagnosticPanelId[];
  activeTab: DiagnosticPanelId;
};

export type DiagnosticDockSplitNode = {
  type: "split";
  orientation: "horizontal" | "vertical";
  sizes: [number, number];
  first: DiagnosticDockNode;
  second: DiagnosticDockNode;
};

export type DiagnosticDockNode =
  | DiagnosticDockTabsNode
  | DiagnosticDockSplitNode;

const DIAGNOSTIC_PANEL_LABELS: Record<DiagnosticPanelId, string> = {
  thoughtRestoration: "思路还原",
  errorExplanation: "错误解释",
  fixDirection: "修正方向",
};

function isDiagnosticPanelId(value: unknown): value is DiagnosticPanelId {
  return (
    typeof value === "string" &&
    DIAGNOSTIC_PANEL_IDS.includes(value as DiagnosticPanelId)
  );
}

function uniquePanelIds(values: unknown[]): DiagnosticPanelId[] {
  const seen = new Set<DiagnosticPanelId>();
  const result: DiagnosticPanelId[] = [];

  for (const value of values) {
    if (!isDiagnosticPanelId(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function normalizeSizes(values: unknown): [number, number] {
  if (!Array.isArray(values) || values.length !== 2) {
    return [50, 50];
  }

  const first = Number(values[0]);
  const second = Number(values[1]);

  if (
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    first < 15 ||
    second < 15
  ) {
    return [50, 50];
  }

  const total = first + second;

  if (total <= 0) {
    return [50, 50];
  }

  return [
    Math.round((first / total) * 100),
    Math.round((second / total) * 100),
  ];
}

function cloneLayout(layout: DiagnosticDockNode): DiagnosticDockNode {
  if (layout.type === "tabs") {
    return {
      type: "tabs",
      tabs: [...layout.tabs],
      activeTab: layout.activeTab,
    };
  }

  return {
    type: "split",
    orientation: layout.orientation,
    sizes: [...layout.sizes],
    first: cloneLayout(layout.first),
    second: cloneLayout(layout.second),
  };
}

function parseNode(value: unknown): DiagnosticDockNode | null {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return null;
  }

  if (value.type === "tabs") {
    const rawTabs = "tabs" in value && Array.isArray(value.tabs)
      ? value.tabs
      : [];
    const tabs = uniquePanelIds(rawTabs);

    if (tabs.length === 0) {
      return null;
    }

    const activeTab =
      "activeTab" in value && isDiagnosticPanelId(value.activeTab)
        ? value.activeTab
        : tabs[0];

    return {
      type: "tabs",
      tabs,
      activeTab: tabs.includes(activeTab) ? activeTab : tabs[0],
    };
  }

  if (value.type === "split") {
    const orientation =
      "orientation" in value && value.orientation === "vertical"
        ? "vertical"
        : "horizontal";
    const first = "first" in value ? parseNode(value.first) : null;
    const second = "second" in value ? parseNode(value.second) : null;

    if (!first || !second) {
      return first ?? second;
    }

    return {
      type: "split",
      orientation,
      sizes: normalizeSizes("sizes" in value ? value.sizes : undefined),
      first,
      second,
    };
  }

  return null;
}

function collectPanels(node: DiagnosticDockNode, seen = new Set<DiagnosticPanelId>()) {
  if (node.type === "tabs") {
    for (const tab of node.tabs) {
      seen.add(tab);
    }

    return seen;
  }

  collectPanels(node.first, seen);
  collectPanels(node.second, seen);

  return seen;
}

function normalizeParsedLayout(node: DiagnosticDockNode): DiagnosticDockNode {
  const panels = collectPanels(node);

  if (DIAGNOSTIC_PANEL_IDS.some((id) => !panels.has(id))) {
    return createDefaultDiagnosticDockLayout();
  }

  return node;
}

function compactNode(node: DiagnosticDockNode | null): DiagnosticDockNode | null {
  if (!node) {
    return null;
  }

  if (node.type === "tabs") {
    if (node.tabs.length === 0) {
      return null;
    }

    return {
      type: "tabs",
      tabs: [...node.tabs],
      activeTab: node.tabs.includes(node.activeTab)
        ? node.activeTab
        : node.tabs[0],
    };
  }

  const first = compactNode(node.first);
  const second = compactNode(node.second);

  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return {
    type: "split",
    orientation: node.orientation,
    sizes: [...node.sizes],
    first,
    second,
  };
}

function removePanelFromNode(
  node: DiagnosticDockNode,
  panelId: DiagnosticPanelId,
): DiagnosticDockNode | null {
  if (node.type === "tabs") {
    const tabs = node.tabs.filter((tab) => tab !== panelId);

    if (tabs.length === 0) {
      return null;
    }

    return {
      type: "tabs",
      tabs,
      activeTab: tabs.includes(node.activeTab) ? node.activeTab : tabs[0],
    };
  }

  return compactNode({
    type: "split",
    orientation: node.orientation,
    sizes: [...node.sizes],
    first: removePanelFromNode(node.first, panelId) ?? {
      type: "tabs",
      tabs: [],
      activeTab: panelId,
    },
    second: removePanelFromNode(node.second, panelId) ?? {
      type: "tabs",
      tabs: [],
      activeTab: panelId,
    },
  });
}

function updateGroup(
  node: DiagnosticDockNode,
  groupId: string,
  updater: (group: DiagnosticDockTabsNode) => DiagnosticDockNode,
  currentId = "root",
): DiagnosticDockNode {
  if (node.type === "tabs") {
    return currentId === groupId ? updater(node) : cloneLayout(node);
  }

  return {
    type: "split",
    orientation: node.orientation,
    sizes: [...node.sizes],
    first: updateGroup(node.first, groupId, updater, `${currentId}-first`),
    second: updateGroup(node.second, groupId, updater, `${currentId}-second`),
  };
}

function splitTargetPanelGroup(
  node: DiagnosticDockNode,
  targetPanelId: DiagnosticPanelId,
  movingPanel: DiagnosticPanelId,
  direction: DiagnosticDockDirection,
): DiagnosticDockNode {
  if (node.type === "tabs") {
    if (!node.tabs.includes(targetPanelId)) {
      return cloneLayout(node);
    }

    const movingGroup: DiagnosticDockTabsNode = {
      type: "tabs",
      tabs: [movingPanel],
      activeTab: movingPanel,
    };
    const targetGroup = cloneLayout(node);
    const orientation =
      direction === "left" || direction === "right"
        ? "horizontal"
        : "vertical";

    return {
      type: "split",
      orientation,
      sizes: [50, 50],
      first:
        direction === "left" || direction === "top"
          ? movingGroup
          : targetGroup,
      second:
        direction === "left" || direction === "top"
          ? targetGroup
          : movingGroup,
    };
  }

  return {
    type: "split",
    orientation: node.orientation,
    sizes: [...node.sizes],
    first: splitTargetPanelGroup(
      node.first,
      targetPanelId,
      movingPanel,
      direction,
    ),
    second: splitTargetPanelGroup(
      node.second,
      targetPanelId,
      movingPanel,
      direction,
    ),
  };
}

function transformGroups(
  node: DiagnosticDockNode,
  updater: (group: DiagnosticDockTabsNode, groupId: string) => DiagnosticDockTabsNode,
  currentId = "root",
): DiagnosticDockNode | null {
  if (node.type === "tabs") {
    return compactNode(updater(node, currentId));
  }

  return compactNode({
    type: "split",
    orientation: node.orientation,
    sizes: [...node.sizes],
    first: transformGroups(node.first, updater, `${currentId}-first`) ?? {
      type: "tabs",
      tabs: [],
      activeTab: DIAGNOSTIC_PANEL_IDS[0],
    },
    second: transformGroups(node.second, updater, `${currentId}-second`) ?? {
      type: "tabs",
      tabs: [],
      activeTab: DIAGNOSTIC_PANEL_IDS[0],
    },
  });
}

export function getDiagnosticPanelLabel(panelId: DiagnosticPanelId) {
  return DIAGNOSTIC_PANEL_LABELS[panelId];
}

export function createDefaultDiagnosticDockLayout(): DiagnosticDockTabsNode {
  return {
    type: "tabs",
    tabs: [...DIAGNOSTIC_PANEL_IDS],
    activeTab: DIAGNOSTIC_PANEL_IDS[0],
  };
}

export function parseDiagnosticDockLayout(input: unknown): DiagnosticDockNode {
  let parsedInput = input;

  if (typeof input === "string") {
    try {
      parsedInput = JSON.parse(input);
    } catch {
      return createDefaultDiagnosticDockLayout();
    }
  }

  const parsed = parseNode(parsedInput);

  return parsed
    ? normalizeParsedLayout(parsed)
    : createDefaultDiagnosticDockLayout();
}

export function moveDiagnosticTabWithinGroup(
  layout: DiagnosticDockNode,
  groupId: string,
  movingPanelId: DiagnosticPanelId,
  beforePanelId: DiagnosticPanelId,
): DiagnosticDockNode {
  return updateGroup(layout, groupId, (group) => {
    const tabs = group.tabs.filter((tab) => tab !== movingPanelId);
    const insertIndex = tabs.indexOf(beforePanelId);

    if (insertIndex === -1) {
      tabs.push(movingPanelId);
    } else {
      tabs.splice(insertIndex, 0, movingPanelId);
    }

    return {
      type: "tabs",
      tabs,
      activeTab: movingPanelId,
    };
  });
}

export function mergeDiagnosticPanelIntoGroup(
  layout: DiagnosticDockNode,
  panelId: DiagnosticPanelId,
  targetGroupId: string,
): DiagnosticDockNode {
  return (
    transformGroups(layout, (group, groupId) => {
      const tabs = group.tabs.filter((tab) => tab !== panelId);

      if (groupId === targetGroupId) {
        tabs.push(panelId);
      }

      return {
        type: "tabs",
        tabs,
        activeTab: groupId === targetGroupId ? panelId : group.activeTab,
      };
    }) ?? createDefaultDiagnosticDockLayout()
  );
}

export function moveDiagnosticPanelToDirection(
  layout: DiagnosticDockNode,
  panelId: DiagnosticPanelId,
  targetPanelId: DiagnosticPanelId,
  direction: DiagnosticDockDirection,
): DiagnosticDockNode {
  if (panelId === targetPanelId) {
    return cloneLayout(layout);
  }

  const withoutPanel = removePanelFromNode(layout, panelId);

  if (!withoutPanel) {
    return createDefaultDiagnosticDockLayout();
  }

  return splitTargetPanelGroup(
    withoutPanel,
    targetPanelId,
    panelId,
    direction,
  );
}

export function resizeDiagnosticSplit(
  layout: DiagnosticDockNode,
  splitId: string,
  sizes: [number, number],
  currentId = "root",
): DiagnosticDockNode {
  if (layout.type === "tabs") {
    return cloneLayout(layout);
  }

  if (currentId === splitId) {
    return {
      type: "split",
      orientation: layout.orientation,
      sizes: normalizeSizes(sizes),
      first: cloneLayout(layout.first),
      second: cloneLayout(layout.second),
    };
  }

  return {
    type: "split",
    orientation: layout.orientation,
    sizes: [...layout.sizes],
    first: resizeDiagnosticSplit(
      layout.first,
      splitId,
      sizes,
      `${currentId}-first`,
    ),
    second: resizeDiagnosticSplit(
      layout.second,
      splitId,
      sizes,
      `${currentId}-second`,
    ),
  };
}

export function setDiagnosticActiveTab(
  layout: DiagnosticDockNode,
  groupId: string,
  panelId: DiagnosticPanelId,
): DiagnosticDockNode {
  return updateGroup(layout, groupId, (group) => {
    if (!group.tabs.includes(panelId)) {
      return group;
    }

    return {
      type: "tabs",
      tabs: [...group.tabs],
      activeTab: panelId,
    };
  });
}

export function activateDiagnosticPanel(
  layout: DiagnosticDockNode,
  panelId: DiagnosticPanelId,
): DiagnosticDockNode {
  if (layout.type === "tabs") {
    if (!layout.tabs.includes(panelId)) {
      return cloneLayout(layout);
    }

    return {
      type: "tabs",
      tabs: [...layout.tabs],
      activeTab: panelId,
    };
  }

  return {
    type: "split",
    orientation: layout.orientation,
    sizes: [...layout.sizes],
    first: activateDiagnosticPanel(layout.first, panelId),
    second: activateDiagnosticPanel(layout.second, panelId),
  };
}
