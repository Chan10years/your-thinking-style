import {
  getAchievableLevelLabel,
  getUsedInPathLabel,
} from "@/lib/analysis-display";
import type {
  FixDirection,
  PersonalizedPath,
  ReferenceCode,
  StandardPath,
} from "@/types/analysis";

type FixDirectionPanelProps = {
  fixDirection: FixDirection;
};

function renderReferenceCodeType(referenceCode: ReferenceCode) {
  if (referenceCode.codeType === "full_code") {
    return "完整代码";
  }

  if (referenceCode.codeType === "partial_code") {
    return "局部代码";
  }

  return "伪代码";
}

function ReferenceCodeDetails({
  referenceCode,
}: {
  referenceCode: ReferenceCode;
}) {
  return (
    <details className="diagnostic-panel__details">
      <summary className="diagnostic-panel__summary">参考代码</summary>
      <dl className="diagnostic-field-list">
        <div className="diagnostic-field">
          <dt className="diagnostic-field__label">类型</dt>
          <dd className="diagnostic-field__value">
            {renderReferenceCodeType(referenceCode)}
          </dd>
        </div>

        <div className="diagnostic-field">
          <dt className="diagnostic-field__label">语言</dt>
          <dd className="diagnostic-field__value">
            {referenceCode.language === "cpp" ? "C++" : "伪代码"}
          </dd>
        </div>
      </dl>

      {referenceCode.available ? (
        <pre className="diagnostic-panel__code">
          <code>{referenceCode.code}</code>
        </pre>
      ) : (
        <p className="diagnostic-panel__empty">
          {referenceCode.unavailableReason}
        </p>
      )}
    </details>
  );
}

function StepsList({ steps }: { steps: string[] }) {
  return (
    <ol className="diagnostic-list diagnostic-list--steps">
      {steps.map((step) => (
        <li key={step} className="diagnostic-list__item">
          {step}
        </li>
      ))}
    </ol>
  );
}

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="diagnostic-panel__empty">暂无。</p>;
  }

  return (
    <ul className="diagnostic-list diagnostic-list--text">
      {items.map((item) => (
        <li key={item} className="diagnostic-list__item">
          {item}
        </li>
      ))}
    </ul>
  );
}

function PersonalizedPathSection({ path }: { path: PersonalizedPath }) {
  return (
    <section className="diagnostic-panel__section">
      <h3 className="diagnostic-panel__section-title">沿原思路修正</h3>

      <dl className="diagnostic-field-list">
        <div className="diagnostic-field">
          <dt className="diagnostic-field__label">策略</dt>
          <dd className="diagnostic-field__value">{path.strategy}</dd>
        </div>

        <div className="diagnostic-field">
          <dt className="diagnostic-field__label">关键算法或数据结构</dt>
          <dd className="diagnostic-field__value">
            {path.keyAlgorithmOrDataStructure}
          </dd>
        </div>

        <div className="diagnostic-field">
          <dt className="diagnostic-field__label">可达到结果</dt>
          <dd className="diagnostic-field__value">
            {getAchievableLevelLabel(path.achievableLevel)}
          </dd>
        </div>
      </dl>

      <div className="diagnostic-field">
        <h4 className="diagnostic-field__label">步骤</h4>
        <StepsList steps={path.steps} />
      </div>

      <div className="diagnostic-field">
        <h4 className="diagnostic-field__label">局限</h4>
        <TextList items={path.limitations} />
      </div>

      <ReferenceCodeDetails referenceCode={path.referenceCode} />
    </section>
  );
}

function StandardPathSection({ path }: { path: StandardPath }) {
  return (
    <section className="diagnostic-panel__section">
      <h3 className="diagnostic-panel__section-title">标准路径</h3>

      <dl className="diagnostic-field-list">
        <div className="diagnostic-field">
          <dt className="diagnostic-field__label">策略</dt>
          <dd className="diagnostic-field__value">{path.strategy}</dd>
        </div>

        <div className="diagnostic-field">
          <dt className="diagnostic-field__label">关键算法或数据结构</dt>
          <dd className="diagnostic-field__value">
            {path.keyAlgorithmOrDataStructure}
          </dd>
        </div>
      </dl>

      <div className="diagnostic-field">
        <h4 className="diagnostic-field__label">步骤</h4>
        <StepsList steps={path.steps} />
      </div>

      <div className="diagnostic-field">
        <h4 className="diagnostic-field__label">相对优势</h4>
        <TextList items={path.advantagesOverPersonalizedPath} />
      </div>

      <ReferenceCodeDetails referenceCode={path.referenceCode} />
    </section>
  );
}

export function FixDirectionPanel({ fixDirection }: FixDirectionPanelProps) {
  return (
    <section className="diagnostic-panel diagnostic-panel--fix-direction">
      <header className="diagnostic-panel__header">
        <h2 className="diagnostic-panel__title">修正方向</h2>
      </header>

      <div className="diagnostic-panel__body">
        <p className="diagnostic-panel__notice">
          建议先阅读“错误解释”，再看修正路径会更容易理解。
        </p>

        <PersonalizedPathSection path={fixDirection.personalizedPath} />
        <StandardPathSection path={fixDirection.standardPath} />

        <section className="diagnostic-panel__section">
          <h3 className="diagnostic-panel__section-title">需要补充的新知识</h3>
          {fixDirection.newKnowledgeNeeded.length > 0 ? (
            <ul className="diagnostic-list diagnostic-list--knowledge">
              {fixDirection.newKnowledgeNeeded.map((item) => (
                <li key={item.topic} className="diagnostic-list__item">
                  <article className="diagnostic-panel__section">
                    <h4 className="diagnostic-panel__section-title">
                      {item.topic}
                    </h4>
                    <dl className="diagnostic-field-list">
                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">为什么需要</dt>
                        <dd className="diagnostic-field__value">
                          {item.whyNeeded}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">用于路径</dt>
                        <dd className="diagnostic-field__value">
                          {item.usedInPath
                            .map((path) => getUsedInPathLabel(path))
                            .join("、")}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">最小解释</dt>
                        <dd className="diagnostic-field__value">
                          {item.minimumExplanation}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <p className="diagnostic-panel__empty">暂无需要额外补充的新知识。</p>
          )}
        </section>
      </div>
    </section>
  );
}
