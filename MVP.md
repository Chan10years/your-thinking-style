# MVP.md
## MVP 目标
完成一个可以实际运行的 YourThinkingStyle 公开网页原型，验证以下核心流程：
用户提交算法题目、C++ 代码，并可选择提供自己的思路或卡点、失败信息；系统通过 DeepSeek 获得结构化分析；代码区域显示蓝色核心算法标注和带编号的红色明确错误标注；右侧展示“思路还原”“错误解释”“修正方向”。
MVP 不运行代码、不编译、不判题、不验证失败样例真实性，不保证发现全部错误，也不得把推测包装成确定结论。
DeepSeek JSON Schema 已在本文档第 3 节冻结为 MVP 版本。后续实现不得擅自增删字段、修改枚举或改变字段语义。
## 1. 输入规格
### 1.1 必填输入
题目：
* 用户可以输入或粘贴算法题目。
* 题目为空时不能发起分析。
* 题目长度限制为 6000 字以内。
代码：
* 使用 Monaco Editor 作为代码编辑器。
* MVP 仅支持 C++。
* 用户可以输入或粘贴 C++ 代码。
* 代码为空时不能发起分析。
* 代码长度限制为 12000 字以内。
* MVP 不运行、编译或判题。
### 1.2 补充信息
补充信息模块默认折叠，所有字段均为可选：
* 我的思路或卡点：800 字以内。
* 失败输入：2000 字以内。
* 预期输出：1000 字以内。
* 实际输出或报错：2000 字以内。
用户可以只填写“我的思路或卡点”，也可以只填写部分失败信息。全部留空时，系统仍根据题目和代码进行静态分析。
超出限制时前端阻止提交，并提示具体字段过长。
分析后必须保留“补充信息”入口，至少能展开查看用户原始填写的“我的思路或卡点”。失败信息有填写时一并显示，未填写时不占用主要注意力。
### 1.3 补充信息用途
“我的思路或卡点”用于帮助系统判断：
* 用户描述的思路是否合理。
* 代码是否正确实现了用户描述的思路。
* 错误来自算法理解、实现细节还是代码边界。
失败信息用于补充静态分析证据。MVP 只支持一个失败样例，不验证失败信息是否真实。
AI 输出时需要区分：
* 已由失败样例直接支持的问题。
* 根据代码静态推测的问题。
* 当前证据不足、无法确认的问题。
## 2. API Key 与请求限制
### 2.1 API Key
* MVP 仅支持 DeepSeek 官方 API。
* 用户可以填写自己的 DeepSeek API Key。
* 公开网页 MVP 采用服务端转发：API Key 在单次请求中短暂发送到服务端，由服务端调用 DeepSeek。
* DeepSeek 接口地址和模型名称由项目统一配置。
* MVP 暂不允许用户自行修改 Base URL 或模型。
* 前端仅在内存中保存 API Key，刷新或关闭页面后消失。
* API Key 只用于当前分析请求。
API Key 不得写入：
* localStorage。
* sessionStorage。
* 源代码。
* 日志。
* 数据库。
* 配置文件。
* 普通文件。
* Git 仓库。
服务端不得记录包含 API Key 的请求头、请求体或错误对象。
### 2.2 分析请求
用户点击“开始分析”后，系统向 DeepSeek 提交：
* 算法题目。
* 用户 C++ 代码。
* 可选的我的思路或卡点。
* 可选的失败输入、预期输出、实际输出或报错。
* 规定的结构化输出要求。
结构化输出必须符合第 3 节定义的 MVP Schema。
请求期间需要显示加载状态，并避免重复提交。
请求限制：
* DeepSeek 请求超时时间为 61 秒。
* 同一浏览器会话同一时间只允许一个分析请求。
* 同一浏览器会话每分钟最多 3 次分析请求。
* 超时后提示 DeepSeek 响应超时，请稍后重试或减少输入内容。
* 已有请求进行中时，新的请求返回明确提示。
* 超过频率限制时，提示稍后再试。
同一浏览器会话的具体识别方式待后续定义。
## 3. DeepSeek 结构化返回
模型必须只返回一个可解析 JSON 对象，不得在 JSON 前后添加 Markdown、解释文字或代码块围栏。
DeepSeek 首次返回结构不合法时，服务端自动重试一次。第二次仍不合法时，页面必须显示明确提示，不展示残缺诊断结果或代码标注。
模型返回超过 3 个蓝色核心算法块，或超过 5 个红色明确错误，视为结构不合规并触发一次自动重试。
### 3.1 Schema 压力测试结论
最终 Schema 压力测试覆盖以下风险：
* 模型只返回自然语言，前端无法解析。
* 模型返回红色错误但没有可定位代码范围。
* 模型返回行列范围但原始代码片段不匹配。
* 模型把疑似问题混入红色错误。
* 模型返回超过数量上限的蓝色块或红色错误。
* 模型未区分失败样例支持、静态推测和证据不足。
* 模型把个性化过渡路径和标准路径混成一个答案。
* 模型声称个性化路径可 AC，却只给局部代码或伪代码。
* 模型无法定位具体红色错误，却为了满足结构强行标红。
* 模型无法还原用户思路却强行编造确定结论。
因此 MVP Schema 必须同时满足：可解析、可定位、可降级、可区分证据来源、可限制数量、可支持三个诊断标签，并且能同时表达个性化过渡路径与标准可复现路径。
### 3.2 顶层结构
```json
{
  "schemaVersion": "mvp-1",
  "thoughtRestoration": {},
  "blueBlocks": [],
  "redErrors": [],
  "redErrorsUnavailableReason": "",
  "suspectedIssues": [],
  "fixDirection": {},
  "meta": {}
}
```
顶层字段规则：
* `schemaVersion` 必须固定为 `"mvp-1"`。
* `thoughtRestoration` 必填，对应“思路还原”。
* `blueBlocks` 必填数组，最多 3 项，可以为空。
* `redErrors` 必填数组，最多 5 项，可以为空。
* `redErrorsUnavailableReason` 可为空字符串；仅当 `thoughtRestoration.status = implementation_bug` 且 `redErrors` 为空时，必须为非空字符串，说明为什么无法可靠定位具体代码范围。
* `suspectedIssues` 必填数组，可以为空；只用于右侧文字说明，不得生成代码区颜色标注。
* `fixDirection` 必填，对应“修正方向”。
* `meta` 必填，用于承载模型不确定性和安全提示。
### 3.3 通用定位对象
蓝色和红色标注必须使用同一种定位对象：
```json
{
  "startLine": 1,
  "startColumn": 1,
  "endLine": 1,
  "endColumn": 1,
  "exactCode": ""
}
```
定位字段规则：
* 行号和列号均从 1 开始。
* `startLine`、`startColumn`、`endLine`、`endColumn` 必须为正整数。
* `endLine`、`endColumn` 表示结束位置的后一位置。
* 范围语义为 `[start, end)`，遵循 Monaco Editor 范围规则。
* `endLine/endColumn` 不得早于或等于 `startLine/startColumn` 指向的起始位置。
* `exactCode` 必须是非空字符串，且必须是用户原始代码中的连续片段。
* 前端或服务端必须校验范围内文本是否与 `exactCode` 匹配；不匹配则该标注定位失败。
### 3.4 思路还原
```json
{
  "status": "thought_flawed",
  "userThoughtSummary": "",
  "codeBehaviorSummary": "",
  "consistencyAnalysis": "",
  "deviationPoint": "",
  "canBeFixedAlongOriginalThought": true,
  "reasoning": "",
  "confidence": "medium"
}
```
字段规则：
* `status` 必须是以下之一：
  * `thought_flawed`：思路本身有问题。
  * `implementation_bug`：思路大体可行，实现出现错误。
  * `thought_code_mismatch`：用户描述的思路与代码实现不一致。
  * `insufficient_information`：信息不足，无法可靠判断用户思路。
* `userThoughtSummary` 总结用户填写的思路；用户未填写时说明未提供思路，只能基于代码推断。
* `codeBehaviorSummary` 总结代码实际实现。
* `consistencyAnalysis` 说明用户思路与代码实现是否一致。
* `deviationPoint` 说明从哪里开始偏离题意或约束；无法判断时写明证据不足。
* `canBeFixedAlongOriginalThought` 表示是否能沿原思路修成正解。
* `reasoning` 说明判断依据。
* `confidence` 必须是 `high`、`medium`、`low` 之一。
* `status` 和 `canBeFixedAlongOriginalThought` 相互独立，禁止根据 `status` 自动推导 `canBeFixedAlongOriginalThought`。
* `status = implementation_bug` 时允许 `redErrors` 为空，但仅限于无法可靠定位具体代码范围的情况；此时 `redErrorsUnavailableReason` 必须非空。
### 3.5 蓝色核心算法块
```json
{
  "location": {},
  "reason": ""
}
```
字段规则：
* `blueBlocks` 最多 3 项，可以为空。
* 每项必须包含 `location` 和 `reason`。
* `location` 使用第 3.3 节通用定位对象。
* `reason` 只用于内部理解和“思路还原”文字参考，不在代码区单独编号或联动。
### 3.6 红色明确错误
```json
{
  "id": "错误 1",
  "location": {},
  "errorType": "logic_error",
  "evidenceLevel": "confirmed",
  "evidenceSources": ["static_analysis"],
  "title": "",
  "explanation": "",
  "runtimeConsequence": "",
  "localFixSuggestion": ""
}
```
字段规则：
* `redErrors` 最多 5 项，可以为空。
* `id` 必须按顺序使用 `错误 1`、`错误 2`、`错误 3`、`错误 4`、`错误 5`。
* `location` 使用第 3.3 节通用定位对象。
* `errorType` 必须是以下之一：
  * `syntax_or_compile_error`
  * `hard_requirement_violation`
  * `boundary_case_error`
  * `logic_error`
  * `runtime_failure_risk`
* `evidenceLevel` 必须固定为 `confirmed`。无法确认的问题不得进入 `redErrors`。
* `evidenceSources` 必须是非空数组，允许值为 `failure_case` 和 `static_analysis`，不得重复。
* 红色是否成立只取决于是否为明确且可确认的错误；证据来源只是说明为什么可以确认。
* `title` 是错误短标题。
* `explanation` 解释错误原因。
* `runtimeConsequence` 说明可能造成的运行结果或逻辑后果。
* `localFixSuggestion` 只给局部修改建议，不展开完整正确算法。
### 3.7 疑似问题
```json
{
  "title": "",
  "evidenceSource": "insufficient_evidence",
  "explanation": "",
  "suggestedVerification": ""
}
```
字段规则：
* `suspectedIssues` 用于承载疑似问题、证据不足问题或需要测试验证的问题。
* `suspectedIssues` 不得生成橙色或任何额外代码标注。
* `evidenceSource` 必须是 `failure_case`、`static_analysis` 或 `insufficient_evidence`。
* 疑似问题可在“思路还原”或“修正方向”中呈现，不进入“错误解释”的红色编号体系。
### 3.8 修正方向
```json
{
  "personalizedPath": {
    "strategy": "",
    "steps": [],
    "keyAlgorithmOrDataStructure": "",
    "referenceCode": {},
    "achievableLevel": "partial_data",
    "limitations": []
  },
  "standardPath": {
    "strategy": "",
    "steps": [],
    "keyAlgorithmOrDataStructure": "",
    "referenceCode": {},
    "advantagesOverPersonalizedPath": []
  },
  "newKnowledgeNeeded": []
}
```
字段规则：
* `personalizedPath` 用于沿用户原思路进行修正、修补、降级优化或设计过渡路径。
* `standardPath` 用于提供标准、更正确或更推荐的方法。
* `newKnowledgeNeeded` 用于记录从用户当前思路过渡到新方法所需的新知识。
* `personalizedPath` 和 `standardPath` 必须分别拥有自己的策略、步骤、算法说明和参考代码，不能共用一个 `referenceCode`。
* `newKnowledgeNeeded` 可以为空，最多 5 项，必须按照用户从当前思路过渡到新方法的学习优先级排列，`topic` 不得重复。
* 是否每次必须输出时间复杂度和空间复杂度仍待确认，因此本版 Schema 不设置复杂度必填字段。
#### 3.8.1 personalizedPath
`personalizedPath` 必须包含：
* `strategy`：沿用户原思路的修正、修补、降级优化或过渡策略。
* `steps`：字符串数组，1 到 6 步。
* `keyAlgorithmOrDataStructure`：该路径使用的关键算法或数据结构。
* `referenceCode`：该路径自己的参考代码对象。
* `achievableLevel`：该路径可达到的结果等级。
* `limitations`：字符串数组，逐条说明该路径的局限。
`achievableLevel` 必须是以下之一：
* `understanding_only`：只能帮助理解，不能形成可靠解法。
* `partial_data`：只能通过部分数据。
* `full_ac_non_optimal`：可以完整通过，但不是最优。
* `full_ac`：可以完整通过。
即使用户原思路无法完整修复，`personalizedPath` 也不能省略，必须说明：
* 原思路具体在哪一步失效。
* 哪些局部思路可以保留。
* 需要放弃或修改的最小部分。
* 如何从用户当前认知过渡到 `standardPath`。
#### 3.8.2 standardPath
`standardPath` 永远必须提供，必须包含：
* `strategy`：标准、更正确或更推荐的方法策略。
* `steps`：字符串数组，1 到 6 步。
* `keyAlgorithmOrDataStructure`：该路径使用的关键算法或数据结构。
* `referenceCode`：该路径自己的参考代码对象。
* `advantagesOverPersonalizedPath`：字符串数组，说明相对个性化路径的优势。
`standardPath.referenceCode` 必须始终满足：
* `available = true`
* `codeType = full_code`
* `language = cpp`
* `code` 为非空的完整可复现 C++ 代码
#### 3.8.3 referenceCode
参考代码对象结构：
```json
{
  "available": true,
  "codeType": "full_code",
  "language": "cpp",
  "code": "",
  "unavailableReason": ""
}
```
字段规则：
* `available` 表示是否提供代码。
* `codeType` 必须是 `full_code`、`partial_code`、`pseudocode` 之一。
* `language` 必须是 `cpp` 或 `pseudo`。
* `codeType = full_code` 或 `partial_code` 时，`language` 必须为 `cpp`。
* `codeType = pseudocode` 时，`language` 可以为 `pseudo`。
* `available = true` 时，`code` 必须为非空字符串。
* `available = false` 时，`unavailableReason` 必须为非空字符串。
* 所有 `referenceCode` 在前端默认折叠展示，折叠状态不由模型决定。
`personalizedPath.achievableLevel` 与 `referenceCode` 必须一致：
* `full_ac`：必须 `available = true`，且为完整 C++ 代码。
* `full_ac_non_optimal`：必须 `available = true`，且为完整 C++ 代码。
* `partial_data`：允许完整 C++ 代码或局部 C++ 代码。
* `understanding_only`：允许伪代码或无代码；无代码时必须说明原因。
#### 3.8.4 newKnowledgeNeeded
每一项结构：
```json
{
  "topic": "",
  "whyNeeded": "",
  "usedInPath": ["standardPath"],
  "minimumExplanation": ""
}
```
字段规则：
* `topic` 是新知识点名称，数组内不得重复。
* `whyNeeded` 说明为什么需要该知识。
* `usedInPath` 是非空数组，允许值为 `personalizedPath` 和 `standardPath`，不得重复。
* `minimumExplanation` 给出足够用户继续理解的最小解释。
### 3.9 Meta
```json
{
  "analysisBasis": [],
  "limitations": [],
  "needsUserVerification": false
}
```
字段规则：
* `analysisBasis` 是枚举数组，允许值为 `problem`、`code`、`user_thought`、`failure_case`。
* `analysisBasis` 至少包含 1 项，且不得重复。
* `limitations` 说明限制，例如未运行代码、未验证失败样例真实性、结论基于静态分析。
* `needsUserVerification` 表示是否建议用户结合测试继续验证。
### 3.10 结构不合法判定
以下情况视为结构不合法：
* 返回内容不是单个 JSON 对象。
* 缺少任一顶层必填字段。
* `schemaVersion` 不是 `"mvp-1"`。
* 数组数量超过上限。
* 枚举值不在允许范围内。
* 红色错误 `id` 不连续或格式不是“错误 n”。
* 红色错误的 `evidenceLevel` 不是 `confirmed`。
* 红色错误使用了单数 `evidenceSource`，或 `evidenceSources` 为空、重复、包含非法值。
* 蓝色或红色标注缺少定位对象，或 `exactCode` 为空。
* 定位对象不符合 Monaco `[start, end)` 范围语义。
* `thoughtRestoration.status = implementation_bug` 且 `redErrors` 为空时，缺少非空 `redErrorsUnavailableReason`。
* `standardPath.referenceCode` 不是完整可复现 C++ 代码。
* `newKnowledgeNeeded` 超过 5 项，或 `topic` 重复。
* `analysisBasis` 为空、重复或包含非法值。
* 需要字符串的位置返回了对象、数组或空值。
* 关键说明字段 trim 后为空字符串。
结构合法但代码片段定位失败，不视为整体结构不合法，按第 6 节降级展示。
### 3.11 关键说明字段非空规则
以下字段 trim 后不得为空字符串：
* `thoughtRestoration.userThoughtSummary`
* `thoughtRestoration.codeBehaviorSummary`
* `thoughtRestoration.consistencyAnalysis`
* `thoughtRestoration.reasoning`
* `blueBlocks[].reason`
* `redErrors[].title`
* `redErrors[].explanation`
* `redErrors[].runtimeConsequence`
* `redErrors[].localFixSuggestion`
* `redErrorsUnavailableReason`，当其按规则必填时
* `suspectedIssues[].title`
* `suspectedIssues[].explanation`
* `suspectedIssues[].suggestedVerification`
* `personalizedPath.strategy`
* `personalizedPath.steps[]`
* `personalizedPath.keyAlgorithmOrDataStructure`
* `personalizedPath.limitations[]`
* `standardPath.strategy`
* `standardPath.steps[]`
* `standardPath.keyAlgorithmOrDataStructure`
* `standardPath.advantagesOverPersonalizedPath[]`
* `referenceCode.code`，当 `available = true` 时
* `referenceCode.unavailableReason`，当 `available = false` 时
* `newKnowledgeNeeded[].topic`
* `newKnowledgeNeeded[].whyNeeded`
* `newKnowledgeNeeded[].minimumExplanation`
* `meta.limitations[]`
## 4. 页面布局
分析前采用近似 1:1 的左右两栏布局：
* 左侧为题目输入区。
* 右侧为代码编辑区。
* 左右两栏下方显示默认折叠的补充信息模块。
分析完成后切换为近似 1:1:1 的三栏布局：
* 左侧为题目区域。
* 中间为带标注的代码区域。
* 右侧为 AI 诊断工作区。
* 分析后仍保留补充信息入口。
外层三栏在分析后保持固定。诊断模块只能在第三栏 AI 诊断工作区内部移动，不能拖出第三栏。
## 5. 代码标注
MVP 只包含：
* 普通代码颜色。
* 蓝色核心算法或疑似核心算法块。
* 红色明确错误代码。
禁止加入橙色疑似错误标注。
### 5.1 蓝色标注
* 使用蓝色标出核心算法或疑似核心算法代码块。
* 蓝色核心算法块最多 3 个。
* 蓝色标注允许为空。
* 蓝色不编号。
* 蓝色不提供单独点击联动。
* 蓝色只标最能代表解题思路的主要算法区域。
### 5.2 红色标注
红色只表示明确且可确认的错误。红色不得用于普通疑点、风格问题、可替代写法，或仅与推荐解法不同的位置。
明确错误包括：
* 语法或编译级错误。
* 题意硬约束违背。
* 边界条件必错。
* 算法逻辑必错。
* 运行时必错风险。
红色规则：
* 红色明确错误最多 5 个。
* 红色错误允许为空。
* 红色错误必须按严重程度排序。
* 每处红色标注必须带有独立编号，例如“错误 1”“错误 2”“错误 3”。
* 不同错误不能共用相同编号。
* 红色代码编号必须与错误解释编号一一对应。
* 红色标注显示在蓝色标注上层。
## 6. 代码定位与降级
蓝色和红色代码标注必须采用“行列范围 + 原始代码片段”的双重定位校验。字段结构以第 3.3 节为准。
定位规则：
* 模型需要返回代码范围和对应原始代码片段。
* 前端或服务端必须校验范围内文本是否与原始代码片段匹配。
* 只有校验成功的标注才能渲染。
* 部分标注定位失败时，定位成功的标注继续展示。
* 定位失败的标注不在代码区渲染。
* 定位失败的红色错误仍在“错误解释”中显示，但必须标明“未能定位到代码，未渲染红色标注”。
* 定位失败的红色错误不参与代码区点击联动。
## 7. AI 诊断工作区
AI 诊断工作区包含三个默认模块：
* 思路还原
* 错误解释
* 修正方向
三个模块以轻量 Docking 面板形式组织，而不是固定三标签页。默认布局为一个标签组，包含“思路还原”“错误解释”“修正方向”，默认选中“思路还原”。

诊断工作区内部需要支持：
* 标签拖动排序。
* 多个模块合并为同一标签组。
* 模块拖到上、下、左、右形成分栏。
* 拖动分隔线调整尺寸。
* 恢复默认布局。
* 当前页面会话内维护布局状态。

诊断工作区暂不支持：
* localStorage 跨刷新持久化。
* 浮动面板。
* 独立浏览器窗口。
* 模块拖出第三栏。
* 关闭或删除模块。
* 多套布局。
* 完整移动端 Docking。

“修正方向”顶部需要提醒用户先查看错误解释更容易理解。参考代码如有提供，必须默认折叠。
代码红蓝标注仍属于中间用户代码区域。AI 诊断工作区只负责解释、路径展示和后续与代码标注联动。
### 7.1 思路还原
展示用户描述的思路、代码实际实现、二者是否一致，以及能否沿用户原思路修成正解。
每次分析必须输出以下分类之一：
* 思路本身有问题。
* 思路大体可行，实现出现错误。
* 用户描述的思路与代码实现不一致。
* 信息不足，无法可靠判断用户思路。
用户未填写“我的思路或卡点”时，必须说明：未提供用户思路，以下为基于代码结构的推断，可能不完整。
### 7.2 错误解释
按照红色代码编号逐条解释明确错误。
该区域只分析对应红色编号的问题，不解释未标红的疑似问题，不展开完整正确算法。
红色错误为空时，显示空状态：未发现可确认的明确错误。当前分析不代表代码一定正确，建议结合测试用例验证。
### 7.3 修正方向
展示沿原思路修正的方向，或说明原思路为什么不可行并给出必须切换的方向。
内容包括：
* 修正路径。
* 关键算法或数据结构。
* 推导过程。
* 必要时提供参考代码。
参考代码默认折叠。
是否每次必须输出时间复杂度和空间复杂度：待确认。
## 8. 红色错误联动
MVP 需要实现红色错误点击联动：
* 点击代码区“错误 1”，右侧切换或滚动到“错误解释”中的“错误 1”。
* 点击右侧“错误 1”，代码区滚动到对应代码。
* 定位失败的红色错误不参与代码区联动。
* 蓝色核心算法块不做联动。
## 9. 重新分析
MVP 需要支持用户修改题目、代码或补充信息后重新发起分析。
重新分析时应避免旧诊断和新输入混在一起误导用户。
重新分析时清除旧结果的具体交互：待确认。
## 10. 异常状态
必须处理：
* 题目为空或超长。
* 代码为空或超长。
* 补充信息字段超长。
* API Key 为空或无效。
* DeepSeek 请求失败或超时。
* 模型返回格式错误。
* 标注定位失败。
* 请求仍在处理中。
* 同会话并发请求。
* 同会话请求频率超限。
错误提示需要说明发生了什么，不能只显示“出错了”。
## 11. 本阶段不实现
已确认不进入 MVP：
* 多语言切换。
* 在线代码运行。
* 代码编译和自动判题。
* 测试用例执行。
* 失败样例真实性验证。
* 用户注册和登录。
* 数据库。
* 题库系统。
* 历史记录和错题收藏。
* 排行榜和社区。
* 付费订阅。
* 平台统一承担模型费用。
* DeepSeek 之外的其他模型服务。
* 用户自定义 Base URL。
* 用户自行选择模型。
* 多模型切换和模型路由。
* 复杂 Agent 工作流。
* 橙色疑似错误标注。
手机端完整适配是否不进入 MVP：待确认。
## 12. 验收标准
MVP 同时满足以下条件才算完成：
* 用户可以输入题目和 C++ 代码。
* 用户可以填写 DeepSeek API Key。
* 用户可以选择性填写“我的思路或卡点”和失败信息。
* 补充信息默认折叠，分析后仍保留入口。
* 有效 API Key 可以通过服务端转发正常发起分析。
* 无效 API Key 会显示明确提示。
* API Key 仅内存保存，不持久化、不记录日志。
* 请求超时时间为 61 秒。
* 同会话同一时间只能有一个分析请求。
* 同会话每分钟最多 3 次分析请求。
* 分析前后布局能够正确切换。
* 分析完成后外层显示原始题目、用户代码、AI 诊断工作区三栏。
* AI 诊断工作区默认包含“思路还原”“错误解释”“修正方向”三个模块。
* AI 诊断工作区支持标签排序、合并为标签组、上下左右分栏、分隔线调整尺寸和恢复默认布局。
* 诊断模块不能拖出 AI 诊断工作区，不能关闭或删除。
* 蓝色核心算法块能够正常显示，且最多 3 个。
* 红色明确错误标注和编号能够正常显示，且最多 5 个。
* 红色错误为空时“错误解释”显示明确空状态。
* 红色编号与错误解释一一对应。
* 红色错误点击联动能够工作。
* 三个诊断区域名称为“思路还原”“错误解释”“修正方向”。
* “思路还原”能够展示分类结论。
* 参考代码默认折叠。
* 代码标注通过行列范围和原始代码片段双重校验。
* 定位失败时不会渲染错误标注，并能显示降级说明。
* DeepSeek 首次结构不合法时自动重试一次。
* 第二次仍不合法时不会展示残缺结果。
* `npm run lint` 可以通过。
* `npm run build` 可以通过。
* 页面没有影响主要流程的明显错误。
蓝色核心算法块为空时是否必须展示专门空状态：待确认。
## 13. MVP 成功判断
用户能够通过“我的思路或卡点”、代码颜色标注、错误编号和结构化诊断，清楚理解：
* 自己原本想怎么解题。
* 代码实际实现了什么。
* 原思路是否能继续修成正解。
* 明确错误在哪里。
* 下一步应该如何修正。
如果用户没有提供自己的思路，系统也能明确说明分析基于代码静态推断，避免把推测包装成确定结论。
## 14. 待确认事项
以下内容此前没有正式冻结，后续需要单独确认：
* 手机端完整适配是否不进入 MVP。
* 蓝色标注为空时是否必须展示专门空状态。
* 重新分析时清除旧结果的具体交互。
* 修正方向是否每次必须输出时间复杂度和空间复杂度。
