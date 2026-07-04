import {
  getConfidenceLabel,
  getThoughtStatusLabel,
} from "@/lib/analysis-display";
import type { ThoughtRestoration } from "@/types/analysis";

type ThoughtRestorationPanelProps = {
  thoughtRestoration: ThoughtRestoration;
  userThought: string;
};

function renderBooleanLabel(value: boolean) {
  return value ? "可以" : "不可以";
}

export function ThoughtRestorationPanel({
  thoughtRestoration,
  userThought,
}: ThoughtRestorationPanelProps) {
  const hasUserThought = userThought.trim().length > 0;

  return (
    <section className="diagnostic-panel diagnostic-panel--thought-restoration">
      <header className="diagnostic-panel__header">
        <h2 className="diagnostic-panel__title">思路还原</h2>
      </header>

      <div className="diagnostic-panel__body">
        {!hasUserThought ? (
          <p className="diagnostic-panel__warning">
            未提供用户思路，以下为基于代码结构的推断，可能不完整。
          </p>
        ) : null}

        <dl className="diagnostic-field-list">
          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">分类</dt>
            <dd className="diagnostic-field__value">
              {getThoughtStatusLabel(thoughtRestoration.status)}
            </dd>
          </div>

          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">用户思路总结</dt>
            <dd className="diagnostic-field__value">
              {thoughtRestoration.userThoughtSummary}
            </dd>
          </div>

          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">代码实际行为</dt>
            <dd className="diagnostic-field__value">
              {thoughtRestoration.codeBehaviorSummary}
            </dd>
          </div>

          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">一致性分析</dt>
            <dd className="diagnostic-field__value">
              {thoughtRestoration.consistencyAnalysis}
            </dd>
          </div>

          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">偏离点</dt>
            <dd className="diagnostic-field__value">
              {thoughtRestoration.deviationPoint}
            </dd>
          </div>

          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">能否沿原思路修正</dt>
            <dd className="diagnostic-field__value">
              {renderBooleanLabel(
                thoughtRestoration.canBeFixedAlongOriginalThought,
              )}
            </dd>
          </div>

          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">判断依据</dt>
            <dd className="diagnostic-field__value">
              {thoughtRestoration.reasoning}
            </dd>
          </div>

          <div className="diagnostic-field">
            <dt className="diagnostic-field__label">置信度</dt>
            <dd className="diagnostic-field__value">
              {getConfidenceLabel(thoughtRestoration.confidence)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
