import type { AnalysisInput } from "@/lib/input-validation";

type SupplementalSummaryProps = {
  input: AnalysisInput;
};

const supplementalFields = [
  { field: "userThought", label: "我的思路或卡点" },
  { field: "failureInput", label: "失败输入" },
  { field: "expectedOutput", label: "预期输出" },
  { field: "actualOutput", label: "实际输出或报错" },
] as const satisfies ReadonlyArray<{
  field: keyof Pick<
    AnalysisInput,
    "userThought" | "failureInput" | "expectedOutput" | "actualOutput"
  >;
  label: string;
}>;

export function SupplementalSummary({ input }: SupplementalSummaryProps) {
  const filledFields = supplementalFields.filter(
    (item) => input[item.field].trim().length > 0,
  );

  return (
    <details className="supplemental-summary">
      <summary>补充信息</summary>
      {filledFields.length > 0 ? (
        <div className="supplemental-summary__content">
          {filledFields.map((item) => (
            <section key={item.field} className="supplemental-summary__item">
              <h3>{item.label}</h3>
              <p>{input[item.field]}</p>
            </section>
          ))}
        </div>
      ) : (
        <p className="supplemental-summary__empty">本次分析未填写补充信息。</p>
      )}
    </details>
  );
}
