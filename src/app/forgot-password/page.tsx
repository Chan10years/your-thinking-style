"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/forget-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, redirectTo: "/reset-password" }),
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message ?? "发送失败，请稍后重试。");
      return;
    }
    setMessage("如果邮箱已注册，密码重置链接会发送到你的邮箱。");
  }

  return (
    <main className="account-page">
      <h1>忘记密码</h1>
      <form onSubmit={submit}>
        <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <button type="submit">发送重置邮件</button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p><Link href="/login">返回登录</Link></p>
    </main>
  );
}
