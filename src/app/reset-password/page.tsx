"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(new URLSearchParams(window.location.search).get("token") ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message ?? "重置失败，请重新申请链接。");
      return;
    }
    setMessage("密码已重置，旧登录会话已失效。请使用新密码登录。");
  }

  return (
    <main className="account-page">
      <h1>重置密码</h1>
      <form onSubmit={submit}>
        <label>新密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
        <button type="submit" disabled={!token}>重置密码</button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p><Link href="/login">返回登录</Link></p>
    </main>
  );
}
