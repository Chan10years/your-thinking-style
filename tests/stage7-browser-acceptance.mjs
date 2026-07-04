import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const port = Number(process.env.STAGE7_CDP_PORT ?? 9337);
const appUrl = process.env.STAGE7_APP_URL ?? "http://localhost:3027/analyze";
const artifactsDir = resolve("artifacts");

const code1 =
  "int main(){ int left = 0; int right = 0; return left + right; }";
const code2 =
  "int main(){ int left = 0; int right = 1; return left + right; }";

function baseAnalysis(titleSuffix = "初次") {
  return {
    schemaVersion: "mvp-1",
    thoughtRestoration: {
      status: "implementation_bug",
      userThoughtSummary: "用户想直接组合两个变量得到答案。",
      codeBehaviorSummary: `${titleSuffix}代码保留了 left 和 right 的简单表达式。`,
      consistencyAnalysis: "思路和代码大体一致，但局部赋值存在明确错误。",
      deviationPoint: "变量初始化处偏离了题目要求。",
      canBeFixedAlongOriginalThought: true,
      reasoning: "修正局部赋值后仍可沿原思路继续。",
      confidence: "high",
    },
    blueBlocks: [
      {
        location: {
          startLine: 1,
          startColumn: 13,
          endLine: 1,
          endColumn: 49,
          exactCode: "int left = 0; int right = 0;",
        },
        reason: "核心变量组合区域。",
      },
    ],
    redErrors: [
      {
        id: "错误 1",
        location: {
          startLine: 1,
          startColumn: 23,
          endLine: 1,
          endColumn: 31,
          exactCode: "left = 0",
        },
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: `左侧赋值错误（${titleSuffix}）`,
        explanation: "left 被固定为 0，无法反映题目输入或推导结果。",
        runtimeConsequence: "参与表达式时会系统性低估答案。",
        localFixSuggestion: "把 left 改为由输入或前序计算得到的值。",
      },
      {
        id: "错误 2",
        location: {
          startLine: 1,
          startColumn: 37,
          endLine: 1,
          endColumn: 46,
          exactCode: "right = 0",
        },
        errorType: "boundary_case_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["failure_case", "static_analysis"],
        title: `右侧赋值错误（${titleSuffix}）`,
        explanation: "right 被固定为 0，失败样例需要它参与非零贡献。",
        runtimeConsequence: "相邻列的错误会导致同一行表达式结果错误。",
        localFixSuggestion: "把 right 改为正确的边界贡献。",
      },
      {
        id: "错误 3",
        location: {
          startLine: 9,
          startColumn: 1,
          endLine: 9,
          endColumn: 12,
          exactCode: "missingCode",
        },
        errorType: "logic_error",
        evidenceLevel: "confirmed",
        evidenceSources: ["static_analysis"],
        title: `无法定位错误（${titleSuffix}）`,
        explanation: "该错误保留文本说明，但不应跳转到代码。",
        runtimeConsequence: "如果误定位会误导用户。",
        localFixSuggestion: "仅在定位可靠时联动。",
      },
    ],
    redErrorsUnavailableReason: "",
    suspectedIssues: [],
    fixDirection: {
      personalizedPath: {
        strategy: "保留当前表达式结构，只修正两个赋值来源。",
        steps: ["修正 left。", "修正 right。", "重新检查表达式。"],
        keyAlgorithmOrDataStructure: "局部变量维护",
        referenceCode: {
          available: true,
          codeType: "partial_code",
          language: "cpp",
          code: "int left = inputLeft;\nint right = inputRight;",
          unavailableReason: "",
        },
        achievableLevel: "partial_data",
        limitations: ["这里只说明局部修正，不展开完整算法。"],
      },
      standardPath: {
        strategy: "按题目约束重新计算每个变量。",
        steps: ["读取输入。", "计算 left。", "计算 right。", "输出结果。"],
        keyAlgorithmOrDataStructure: "线性扫描",
        referenceCode: {
          available: true,
          codeType: "full_code",
          language: "cpp",
          code: "#include <iostream>\nint main(){return 0;}",
          unavailableReason: "",
        },
        advantagesOverPersonalizedPath: ["更容易覆盖边界。"],
      },
      newKnowledgeNeeded: [],
    },
    meta: {
      analysisBasis: ["problem", "code", "user_thought", "failure_case"],
      limitations: ["未运行代码。", "未验证失败样例真实性。"],
      needsUserVerification: true,
    },
  };
}

function updatedAnalysis(titleSuffix = "重新分析成功") {
  const analysis = baseAnalysis(titleSuffix);
  analysis.blueBlocks = [];
  analysis.redErrors = [
    {
      ...analysis.redErrors[0],
      title: `新结果只保留左侧错误（${titleSuffix}）`,
      location: {
        startLine: 1,
        startColumn: 23,
        endLine: 1,
        endColumn: 31,
        exactCode: "left = 0",
      },
    },
  ];
  return analysis;
}

async function createTarget() {
  const response = await fetch(`http://127.0.0.1:${port}/json/new`, {
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`Cannot create CDP target: ${response.status}`);
  }

  return response.json();
}

function connect(wsUrl) {
  return new Promise((resolveSocket, rejectSocket) => {
    const socket = new WebSocket(wsUrl);
    const callbacks = new Map();
    const events = [];
    let id = 0;

    socket.addEventListener("open", () => {
      resolveSocket({
        events,
        send(method, params = {}) {
          id += 1;
          const messageId = id;
          socket.send(JSON.stringify({ id: messageId, method, params }));

          return new Promise((resolveCommand, rejectCommand) => {
            callbacks.set(messageId, { resolveCommand, rejectCommand, method });
          });
        },
        close() {
          socket.close();
        },
        waitForEvent(method, timeoutMs = 10_000) {
          const existing = events.find((event) => event.method === method);

          if (existing) {
            return Promise.resolve(existing.params);
          }

          return new Promise((resolveEvent, rejectEvent) => {
            const started = Date.now();
            const timer = setInterval(() => {
              const event = events.find((entry) => entry.method === method);

              if (event) {
                clearInterval(timer);
                resolveEvent(event.params);
              } else if (Date.now() - started > timeoutMs) {
                clearInterval(timer);
                rejectEvent(new Error(`Timed out waiting for ${method}`));
              }
            }, 50);
          });
        },
      });
    });

    socket.addEventListener("error", rejectSocket);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));

      if (message.id && callbacks.has(message.id)) {
        const callback = callbacks.get(message.id);
        callbacks.delete(message.id);

        if (message.error) {
          callback.rejectCommand(
            new Error(`${callback.method}: ${message.error.message}`),
          );
        } else {
          callback.resolveCommand(message.result ?? {});
        }
        return;
      }

      if (message.method) {
        events.push(message);
      }
    });
  });
}

const target = await createTarget();
const cdp = await connect(target.webSocketDebuggerUrl);
const consoleEntries = [];

await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Log.enable");
await cdp.send("Network.enable");

cdp.events.push = new Proxy(cdp.events.push, {
  apply(targetPush, thisArg, args) {
    const [event] = args;
    if (
      event?.method === "Runtime.consoleAPICalled" ||
      event?.method === "Runtime.exceptionThrown" ||
      event?.method === "Log.entryAdded"
    ) {
      consoleEntries.push(event);
    }

    return Reflect.apply(targetPush, thisArg, args);
  },
});

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });

  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime evaluation failed",
    );
  }

  return result.result.value;
}

async function waitFor(expression, timeoutMs = 10_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(expression);

    if (value) {
      return value;
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }

  throw new Error(`Timed out waiting for ${expression}`);
}

async function rectFor(expression) {
  const rect = await evaluate(`(() => {
    const el = ${expression};
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  })()`);

  assert.ok(rect, `Missing element for ${expression}`);
  return rect;
}

async function clickExpression(expression) {
  const rect = await rectFor(expression);
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: rect.x,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
}

async function insertText(text) {
  await cdp.send("Input.insertText", { text });
}

async function ctrlA() {
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
    modifiers: 2,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Control",
    code: "ControlLeft",
    windowsVirtualKeyCode: 17,
  });
}

await cdp.send("Page.navigate", { url: appUrl });
await cdp.waitForEvent("Page.loadEventFired");
await waitFor("document.querySelector('.monaco-editor') !== null");

await evaluate(`(() => {
  const first = ${JSON.stringify(baseAnalysis("初次"))};
  const second = ${JSON.stringify(updatedAnalysis("修改后"))};
  const third = ${JSON.stringify(updatedAnalysis("重新分析成功"))};
  const fourth = ${JSON.stringify(updatedAnalysis("重复点击检查"))};
  window.__stage7 = {
    requests: [],
    failNext: false,
    delayNextMs: 0,
    responses: [first, second, third, fourth]
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes('/api/analyze')) {
      return nativeFetch(input, init);
    }
    const body = JSON.parse(String(init?.body ?? '{}'));
    window.__stage7.requests.push(body);
    if (window.__stage7.delayNextMs > 0) {
      const delay = window.__stage7.delayNextMs;
      window.__stage7.delayNextMs = 0;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (window.__stage7.failNext) {
      window.__stage7.failNext = false;
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MOCK_FAILURE', message: '模拟重新分析失败。' }
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
    const response = window.__stage7.responses[
      Math.min(window.__stage7.requests.length - 1, window.__stage7.responses.length - 1)
    ];
    return new Response(JSON.stringify({ success: true, data: response }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
})()`);

await evaluate(`(() => {
  function setValue(selector, value) {
    const el = document.querySelector(selector);
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
  }
  setValue('#problem', '给定两个变量，计算组合结果。');
  setValue('#userThought', '我想直接用两个变量相加。');
  setValue('#failureInput', 'left=2 right=3');
})()`);

await clickExpression("document.querySelector('.workspace-code .monaco-editor')");
await insertText(code1);
await clickExpression("[...document.querySelectorAll('button')].find((button) => button.textContent.includes('API Key'))");
await waitFor("document.querySelector('#apiKey') !== null");
await evaluate(`(() => {
  const input = document.querySelector('#apiKey');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'sk-browser-stage7');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'sk-browser-stage7', inputType: 'insertText' }));
  [...document.querySelectorAll('button')].find((button) => button.textContent.includes('保存到当前页面')).click();
})()`);
await clickExpression("document.querySelector('.workspace-toolbar__submit')");
await waitFor("document.querySelector('.analysis-result-workspace') !== null");
await waitFor("document.querySelectorAll('.code-annotation-badge--red').length >= 2");

await clickExpression("[...document.querySelectorAll('[role=tab]')].find((tab) => tab.textContent.includes('错误解释'))");
await waitFor("document.querySelector('[data-error-id=\"错误 1\"]') !== null");

await evaluate("document.querySelector('[data-error-id=\"错误 2\"]').click()");
await waitFor("document.querySelector('[data-error-id=\"错误 2\"]')?.dataset.active === 'true'");
await waitFor("document.querySelectorAll('.code-annotation--red-active').length === 1");

await clickExpression("[...document.querySelectorAll('.code-annotation-badge--red')].find((badge) => badge.textContent.trim() === '1')");
await waitFor("document.querySelector('[data-error-id=\"错误 1\"]')?.dataset.active === 'true'");
assert.equal(
  await evaluate("[...document.querySelectorAll('[role=tab]')].find((tab) => tab.textContent.includes('错误解释'))?.getAttribute('aria-selected')"),
  "true",
);
assert.equal(
  await evaluate(`(() => {
    const rect = document.querySelector('[data-error-id="错误 1"]').getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  })()`),
  true,
);

await evaluate(`(() => {
  const tab = [...document.querySelectorAll('[role=tab]')]
    .find((candidate) => candidate.textContent.includes('修正方向'));
  window.__stage7DragTransfer = new DataTransfer();
  tab.dispatchEvent(new DragEvent('dragstart', {
    bubbles: true,
    dataTransfer: window.__stage7DragTransfer
  }));
})()`);
await waitFor("document.querySelector('.diagnostic-dock-drop-zone--right') !== null");
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('[role=tab]')]
    .find((candidate) => candidate.textContent.includes('修正方向'));
  const zone = document.querySelector('.diagnostic-dock-drop-zone--right');
  zone.dispatchEvent(new DragEvent('dragover', {
    bubbles: true,
    dataTransfer: window.__stage7DragTransfer
  }));
  zone.dispatchEvent(new DragEvent('drop', {
    bubbles: true,
    dataTransfer: window.__stage7DragTransfer
  }));
  tab.dispatchEvent(new DragEvent('dragend', {
    bubbles: true,
    dataTransfer: window.__stage7DragTransfer
  }));
})()`);
await waitFor("document.querySelector('.diagnostic-dock-split') !== null");
await clickExpression("[...document.querySelectorAll('.code-annotation-badge--red')].find((badge) => badge.textContent.trim() === '2')");
await waitFor("document.querySelector('[data-error-id=\"错误 2\"]')?.dataset.active === 'true'");

const separatorRect = await rectFor("document.querySelector('.diagnostic-dock-separator')");
await cdp.send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  x: separatorRect.x,
  y: separatorRect.y,
  button: "left",
  clickCount: 1,
});
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseMoved",
  x: separatorRect.x + 36,
  y: separatorRect.y,
  button: "left",
});
await cdp.send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  x: separatorRect.x + 36,
  y: separatorRect.y,
  button: "left",
});
await evaluate("document.querySelector('[data-error-id=\"错误 1\"]').click()");
await waitFor("document.querySelector('[data-error-id=\"错误 1\"]')?.dataset.active === 'true'");

await evaluate("[...document.querySelectorAll('button')].find((button) => button.textContent.includes('返回编辑')).click()");
await waitFor("document.querySelector('.analysis-result-workspace') === null");
await waitFor("document.querySelector('.workspace-code .monaco-editor') !== null");
await clickExpression("document.querySelector('.workspace-code .monaco-editor')");
await ctrlA();
await insertText(code2);
await clickExpression("document.querySelector('.workspace-toolbar__submit')");
await waitFor("document.querySelector('.analysis-result-workspace') !== null");
await waitFor("document.body.textContent.includes('修改后代码保留')");

await clickExpression("document.querySelector('.analysis-result-workspace__reanalyze')");
await waitFor("window.__stage7.requests.length >= 3");
assert.equal(await evaluate("window.__stage7.requests[2].code"), code2);
await waitFor("document.body.textContent.includes('重新分析成功')");
assert.equal(
  await evaluate("document.querySelector('[data-active=\"true\"]') === null"),
  true,
);
assert.equal(
  await evaluate("document.body.textContent.includes('右侧赋值错误（初次）')"),
  false,
);

await evaluate("window.__stage7.failNext = true");
await clickExpression("document.querySelector('.analysis-result-workspace__reanalyze')");
await waitFor("document.body.textContent.includes('模拟重新分析失败。')");
assert.equal(
  await evaluate("document.body.textContent.includes('重新分析成功')"),
  true,
);

const beforeDouble = await evaluate("window.__stage7.requests.length");
await evaluate("window.__stage7.delayNextMs = 900");
await clickExpression("document.querySelector('.analysis-result-workspace__reanalyze')");
await clickExpression("document.querySelector('.analysis-result-workspace__reanalyze')");
await waitFor(`window.__stage7.requests.length === ${beforeDouble + 1}`);
await waitFor("document.body.textContent.includes('重复点击检查')");

await mkdir(artifactsDir, { recursive: true });
const screenshot = await cdp.send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
});
const screenshotPath = resolve(artifactsDir, "stage7-browser-acceptance.png");
await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

const severeConsole = consoleEntries
  .filter((event) => {
    if (event.method === "Runtime.exceptionThrown") {
      return true;
    }
    if (event.method === "Runtime.consoleAPICalled") {
      return ["error", "warning"].includes(event.params.type);
    }
    if (event.method === "Log.entryAdded") {
      return ["error", "warning"].includes(event.params.entry.level);
    }
    return false;
  })
  .map((event) => {
    if (event.method === "Runtime.consoleAPICalled") {
      return {
        method: event.method,
        level: event.params.type,
        text: event.params.args.map((arg) => arg.value ?? arg.description).join(" "),
      };
    }
    if (event.method === "Log.entryAdded") {
      return {
        method: event.method,
        level: event.params.entry.level,
        text: event.params.entry.text,
      };
    }
    return {
      method: event.method,
      level: "error",
      text:
        event.params.exceptionDetails?.exception?.description ??
        event.params.exceptionDetails?.text ??
        "exception",
    };
  });

console.log(
  JSON.stringify(
    {
      requests: await evaluate("window.__stage7.requests.length"),
      finalBodyHasDuplicateRequestBlocked: true,
      screenshotPath,
      severeConsole,
    },
    null,
    2,
  ),
);

cdp.close();
