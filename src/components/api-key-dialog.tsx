"use client";

import { useEffect, useRef } from "react";

export function ApiKeyDialog({
  open,
  value,
  error,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="api-key-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="api-key-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="api-key-dialog__header">
          <div>
            <p>DEEPSEEK / SINGLE REQUEST</p>
            <h2 id="api-key-title">配置 API Key</h2>
          </div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <p className="api-key-dialog__description">
          Key 只保存在当前页面内存中；刷新或关闭页面后消失，不写入浏览器存储、日志或文件。
        </p>

        <label htmlFor="apiKey">DeepSeek API Key</label>
        <input
          ref={inputRef}
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          value={value}
          placeholder="sk-..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "apiKey-error" : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {error ? (
          <p id="apiKey-error" className="workspace-field-error">
            {error}
          </p>
        ) : null}

        <button type="button" className="api-key-dialog__save" onClick={onClose}>
          保存到当前页面
        </button>
      </section>
    </div>
  );
}
