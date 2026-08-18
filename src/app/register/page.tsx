"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || "用户", email, password, callbackURL: "/analyze" }),
    });
    const payload = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      setError(payload.error?.message ?? "注册失败，请稍后重试。");
      return;
    }
    setMessage("注册成功。请打开邮箱中的验证链接后再登录。");
  }

  return (
    <main className="account-page">
      <h1>注册账户</h1>
      <form onSubmit={submit}>
        <label>名称（可选）<input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} /></label>
        <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
        <button type="submit">注册</button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p><Link href="/login">返回登录</Link></p>
    </main>
  );
}
