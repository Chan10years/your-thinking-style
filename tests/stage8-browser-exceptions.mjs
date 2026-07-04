import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const port = Number(process.env.STAGE8_CDP_PORT ?? 9337);
const appUrl = process.env.STAGE8_APP_URL ?? "http://localhost:3027/analyze";
const artifactsDir = resolve("artifacts");
const code =
  "int main(){ int left = 0; int right = 0; return left + right; }";

function analysis(label) {
  return {
    schemaVersion: "mvp-1",
    thoughtRestoration: {
      status: "implementation_bug",
      userThoughtSummary: "用户想直接组合两个变量得到答案。",
      codeBehaviorSummary: `${label}代码保留了 left 和 right 的简单表达式。`,
      consistencyAnalysis: "思路和代码大体一致，但局部赋值存在明确错误。",
      deviationPoint: "变量初始化处偏离了题目要求。",
      canBeFixedAlongOriginalThought: true,
      reasoning: "修正局部赋值后仍可沿原思路继续。",
      confidence: "high",
    },
    blueBlocks: [],
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
        title: `左侧赋值错误（${label}）`,
        explanation: "left 被固定为 0，无法反映题目输入或推导结果。",
        runtimeConsequence: "参与表达式时会系统性低估答案。",
        localFixSuggestion: "把 left 改为由输入或前序计算得到的值。",
      },
    ],
    redErrorsUnavailableReason: "",
    suspectedIssues: [],
    fixDirection: {
      personalizedPath: {
        strategy: "保留当前表达式结构，只修正赋值来源。",
        steps: ["修正 left。", "重新检查表达式。"],
        keyAlgorithmOrDataStructure: "局部变量维护",
        referenceCode: {
          available: true,
          codeType: "partial_code",
          language: "cpp",
          code: "int left = inputLeft;",
          unavailableReason: "",
        },
        achievableLevel: "partial_data",
        limitations: ["这里只说明局部修正，不展开完整算法。"],
      },
      standardPath: {
        strategy: "按题目约束重新计算每个变量。",
        steps: ["读取输入。", "计算 left。", "输出结果。"],
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
      analysisBasis: ["problem", "code", "user_thought"],
      limitations: ["未运行代码。"],
      needsUserVerification: true,
    },
  };
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

await cdp.send("Page.enable");
await cdp.send("Runtime.enable");

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
      y: rect.top + rect.height / 2
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

await cdp.send("Page.navigate", { url: appUrl });
await cdp.waitForEvent("Page.loadEventFired");
await waitFor("document.querySelector('.monaco-editor') !== null");

await evaluate(`(() => {
  const success = ${JSON.stringify(analysis("成功"))};
  window.__stage8 = {
    requests: [],
    responses: [
      { ok: false, status: 500, body: { success: false, error: { code: 'MOCK_FIRST_FAILURE', message: '模拟首次分析失败。' } } },
      { ok: true, status: 200, body: { success: true, data: success } },
      { ok: false, status: 500, body: { success: false, error: { code: 'MOCK_REANALYSIS_FAILURE', message: '模拟重新分析失败。' } } }
    ]
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input);
    if (!url.includes('/api/analyze')) {
      return nativeFetch(input, init);
    }
    window.__stage8.requests.push(JSON.parse(String(init?.body ?? '{}')));
    const response = window.__stage8.responses[
      Math.min(window.__stage8.requests.length - 1, window.__stage8.responses.length - 1)
    ];
    return new Response(JSON.stringify(response.body), {
      status: response.status,
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
})()`);

await clickExpression("document.querySelector('.workspace-code .monaco-editor')");
await insertText(code);
await clickExpression("[...document.querySelectorAll('button')].find((button) => button.textContent.includes('API Key'))");
await waitFor("document.querySelector('#apiKey') !== null");
await evaluate(`(() => {
  const input = document.querySelector('#apiKey');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'sk-browser-stage8');
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'sk-browser-stage8', inputType: 'insertText' }));
  [...document.querySelectorAll('button')].find((button) => button.textContent.includes('保存到当前页面')).click();
})()`);

await clickExpression("document.querySelector('.workspace-toolbar__submit')");
await waitFor("document.body.textContent.includes('模拟首次分析失败。')");
assert.equal(
  await evaluate("document.querySelector('.analysis-result-workspace') === null"),
  true,
);
assert.equal(
  await evaluate("document.querySelector('.workspace-toolbar__submit').disabled"),
  false,
);
assert.equal(
  await evaluate("document.querySelector('.workspace-toolbar__submit').textContent.trim()"),
  "开始分析",
);

await clickExpression("document.querySelector('.workspace-toolbar__submit')");
await waitFor("document.querySelector('.analysis-result-workspace') !== null");
await waitFor("document.body.textContent.includes('成功代码保留')");

await evaluate(`(() => {
  const tab = [...document.querySelectorAll('[role=tab]')]
    .find((candidate) => candidate.textContent.includes('修正方向'));
  window.__stage8DragTransfer = new DataTransfer();
  tab.dispatchEvent(new DragEvent('dragstart', {
    bubbles: true,
    dataTransfer: window.__stage8DragTransfer
  }));
})()`);
await waitFor("document.querySelector('.diagnostic-dock-drop-zone--right') !== null");
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('[role=tab]')]
    .find((candidate) => candidate.textContent.includes('修正方向'));
  const zone = document.querySelector('.diagnostic-dock-drop-zone--right');
  zone.dispatchEvent(new DragEvent('dragover', {
    bubbles: true,
    dataTransfer: window.__stage8DragTransfer
  }));
  zone.dispatchEvent(new DragEvent('drop', {
    bubbles: true,
    dataTransfer: window.__stage8DragTransfer
  }));
  tab.dispatchEvent(new DragEvent('dragend', {
    bubbles: true,
    dataTransfer: window.__stage8DragTransfer
  }));
})()`);
await waitFor("document.querySelector('.diagnostic-dock-split') !== null");

await clickExpression("document.querySelector('.analysis-result-workspace__reanalyze')");
await waitFor("document.body.textContent.includes('模拟重新分析失败。')");
assert.equal(
  await evaluate("document.body.textContent.includes('成功代码保留')"),
  true,
);
assert.equal(
  await evaluate("document.querySelector('.diagnostic-dock-split') !== null"),
  true,
);
assert.equal(
  await evaluate("document.querySelector('.analysis-result-workspace__reanalyze').disabled"),
  false,
);

await mkdir(artifactsDir, { recursive: true });
const screenshot = await cdp.send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
});
const screenshotPath = resolve(artifactsDir, "stage8-browser-exceptions.png");
await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

console.log(
  JSON.stringify(
    {
      requests: await evaluate("window.__stage8.requests.length"),
      firstFailureRecovered: true,
      reanalysisFailureKeptOldResult: true,
      dockLayoutKeptAfterFailure: true,
      screenshotPath,
    },
    null,
    2,
  ),
);

cdp.close();
