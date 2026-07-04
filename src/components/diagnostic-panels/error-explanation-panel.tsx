import {
  getEvidenceSourceLabel,
  getRedErrorTypeLabel,
} from "@/lib/analysis-display";
import type { RedErrorLocationStatus } from "@/lib/code-annotation-decorations";
import type { RedErrorLink } from "@/lib/error-linkage";
import type { RedError, SuspectedIssue } from "@/types/analysis";

type ErrorExplanationPanelProps = {
  redErrors: RedError[];
  redErrorsUnavailableReason: string;
  suspectedIssues: SuspectedIssue[];
  redErrorLocationStatuses?: RedErrorLocationStatus[];
  redErrorLinks?: RedErrorLink[];
  activeErrorId?: string | null;
  onRedErrorClick?: (errorId: string) => void;
  registerRedErrorRef?: (errorId: string, element: HTMLElement | null) => void;
};

export function ErrorExplanationPanel({
  redErrors,
  redErrorsUnavailableReason,
  suspectedIssues,
  redErrorLocationStatuses = [],
  redErrorLinks = [],
  activeErrorId = null,
  onRedErrorClick,
  registerRedErrorRef,
}: ErrorExplanationPanelProps) {
  const unavailableReason = redErrorsUnavailableReason.trim();
  const locationStatusById = new Map(
    redErrorLocationStatuses.map((status) => [status.id, status]),
  );

  return (
    <section className="diagnostic-panel diagnostic-panel--error-explanation">
      <header className="diagnostic-panel__header">
        <h2 className="diagnostic-panel__title">错误解释</h2>
      </header>

      <div className="diagnostic-panel__body">
        {unavailableReason.length > 0 ? (
          <p className="diagnostic-panel__notice">{unavailableReason}</p>
        ) : null}

        {redErrors.length > 0 ? (
          <ol className="diagnostic-list diagnostic-list--red-errors">
            {redErrors.map((error, index) => {
              const link = redErrorLinks[index];
              const errorLinkId = link?.id ?? error.id;
              const locationStatus =
                link?.status ?? locationStatusById.get(errorLinkId);
              const isActive = activeErrorId === errorLinkId;

              return (
                <li key={errorLinkId} className="diagnostic-list__item">
                  <article
                    ref={(element) =>
                      registerRedErrorRef?.(errorLinkId, element)
                    }
                    className={`diagnostic-panel__section diagnostic-red-error-card ${
                      isActive ? "is-active" : ""
                    }`}
                    data-error-id={errorLinkId}
                    data-active={isActive ? "true" : "false"}
                    onClick={() => onRedErrorClick?.(errorLinkId)}
                  >
                    <header className="diagnostic-panel__section-header">
                      <p className="diagnostic-panel__eyebrow">{error.id}</p>
                      <h3 className="diagnostic-panel__section-title">
                        {error.title}
                      </h3>
                      {locationStatus ? (
                        <p
                          className={`diagnostic-location-status ${
                            locationStatus.located
                              ? "is-located"
                              : "is-unlocated"
                          }`}
                        >
                          {locationStatus.label}
                        </p>
                      ) : null}
                    </header>

                    <dl className="diagnostic-field-list">
                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">类型</dt>
                        <dd className="diagnostic-field__value">
                          {getRedErrorTypeLabel(error.errorType)}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">证据来源</dt>
                        <dd className="diagnostic-field__value">
                          {error.evidenceSources
                            .map((source) => getEvidenceSourceLabel(source))
                            .join("、")}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">错误原因</dt>
                        <dd className="diagnostic-field__value">
                          {error.explanation}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">运行后果</dt>
                        <dd className="diagnostic-field__value">
                          {error.runtimeConsequence}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">局部修正</dt>
                        <dd className="diagnostic-field__value">
                          {error.localFixSuggestion}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="diagnostic-panel__empty">
            未发现可确认的明确错误。当前分析不代表代码一定正确，建议结合测试用例验证。
          </p>
        )}

        {suspectedIssues.length > 0 ? (
          <section className="diagnostic-panel__auxiliary">
            <h3 className="diagnostic-panel__section-title">
              辅助疑似问题
            </h3>
            <p className="diagnostic-panel__note">
              以下内容不生成代码颜色标注。
            </p>
            <ul className="diagnostic-list diagnostic-list--suspected-issues">
              {suspectedIssues.map((issue) => (
                <li key={issue.title} className="diagnostic-list__item">
                  <article className="diagnostic-panel__section">
                    <h4 className="diagnostic-panel__section-title">
                      {issue.title}
                    </h4>
                    <dl className="diagnostic-field-list">
                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">证据来源</dt>
                        <dd className="diagnostic-field__value">
                          {getEvidenceSourceLabel(issue.evidenceSource)}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">说明</dt>
                        <dd className="diagnostic-field__value">
                          {issue.explanation}
                        </dd>
                      </div>

                      <div className="diagnostic-field">
                        <dt className="diagnostic-field__label">建议验证</dt>
                        <dd className="diagnostic-field__value">
                          {issue.suggestedVerification}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}
