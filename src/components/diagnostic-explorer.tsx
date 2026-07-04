"use client";

import Link from "next/link";
import { useState } from "react";

import { diagnosticTabs } from "@/lib/site-content";

export function DiagnosticExplorer() {
  const [activeId, setActiveId] = useState<
    (typeof diagnosticTabs)[number]["id"]
  >(diagnosticTabs[0].id);
  const activeTab =
    diagnosticTabs.find((tab) => tab.id === activeId) ?? diagnosticTabs[0];

  return (
    <section className="diagnostic-explorer">
      <div className="diagnostic-explorer__tabs" role="tablist" aria-label="诊断结构">
        {diagnosticTabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab.id === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveId(tab.id)}
          >
            <span>{tab.eyebrow}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`panel-${activeTab.id}`}
        className="diagnostic-explorer__panel"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab.id}`}
        tabIndex={0}
      >
        <div className="diagnostic-explorer__statement">
          <p>{activeTab.eyebrow}</p>
          <h2>{activeTab.title}</h2>
        </div>

        <div className="diagnostic-explorer__content">
          <p className="diagnostic-explorer__summary">{activeTab.summary}</p>
          <ol>
            {activeTab.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="diagnostic-explorer__footer">
        <p>三个标签共同构成一次完整诊断。</p>
        <Link href="/analyze">开始探索</Link>
      </div>
    </section>
  );
}
