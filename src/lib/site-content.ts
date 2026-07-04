export const primaryNavigation = [
  { href: "/", label: "入口" },
  { href: "/explore", label: "核心方法" },
  { href: "/analyze", label: "开始分析" },
] as const;

export const diagnosticTabs = [
  {
    id: "thought",
    label: "思路还原",
    eyebrow: "THOUGHT RESTORATION",
    title: "先还原你原本想怎么解题。",
    summary:
      "系统会同时阅读你的思路描述与代码结构，区分“你想做什么”和“代码实际做了什么”。",
    details: [
      "你的思路：希望通过双指针逐步缩小搜索区间。",
      "代码行为：右指针按中点回退，但当前判断条件并不保证区间能够正确收缩。",
      "结论：方向可以保留，实现过程需要重新对齐题目的单调性条件。",
    ],
  },
  {
    id: "error",
    label: "错误解释",
    eyebrow: "CONFIRMED ERRORS",
    title: "只把能够确认的问题标成错误。",
    summary:
      "红色只用于明确且可以解释的错误；证据不足的疑点不会被包装成确定结论。",
    details: [
      "错误 1：循环边界会跳过最后一个候选位置。",
      "直接后果：当答案位于右端点时，程序会提前结束并返回错误结果。",
      "证据来源：代码静态分析；未运行代码，也不会伪造测试结论。",
    ],
  },
  {
    id: "direction",
    label: "修正方向",
    eyebrow: "NEXT DIRECTION",
    title: "优先沿你的原思路继续修。",
    summary:
      "能够保留的部分不会被标准答案覆盖；只有原方向确实不可行时，才说明为什么需要切换方法。",
    details: [
      "保留双指针缩小区间的框架。",
      "先确认判定条件是否具有单调性，再决定移动哪一侧指针。",
      "补充端点不变量，保证答案始终留在当前搜索区间内。",
    ],
  },
] as const;
