"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

async function callAuth(path: string, body: Record<string, string>) {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "账户操作失败，请稍后重试。");
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await callAuth("sign-in/email", { email, password, callbackURL: "/analyze" });
      window.location.assign("/analyze");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败。");
    }
  }

  return (
    <main className="account-page">
      <h1>登录</h1>
      <form onSubmit={submit}>
        <label>
          邮箱
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        </label>
        <button type="submit">登录</button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p><Link href="/register">注册账户</Link> · <Link href="/forgot-password">忘记密码</Link></p>
    </main>
  );
}
