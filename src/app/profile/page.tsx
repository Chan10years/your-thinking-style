"use client";

import Link from "next/link";
import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

type Profile = { nickname: string; avatarSeed: string; avatarPath: string | null };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfile() {
    const response = await fetch("/api/profile");
    const payload = (await response.json()) as { profile?: Profile; error?: { message?: string } };
    if (!response.ok || !payload.profile) {
      setError(payload.error?.message ?? "无法读取资料。");
      return;
    }
    setProfile(payload.profile);
    setNickname(payload.profile.nickname);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    const payload = (await response.json()) as { profile?: Profile; error?: { message?: string } };
    if (!response.ok || !payload.profile) {
      setError(payload.error?.message ?? "保存失败。");
      return;
    }
    setProfile(payload.profile);
    setNickname(payload.profile.nickname);
    setMessage("资料已保存。");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("avatar", file);
    const response = await fetch("/api/profile/avatar", { method: "POST", body: formData });
    const payload = (await response.json()) as { profile?: Profile; error?: { message?: string } };
    if (!response.ok || !payload.profile) {
      setError(payload.error?.message ?? "头像上传失败。");
      return;
    }
    setProfile(payload.profile);
    setMessage("头像已更新。");
  }

  async function removeAvatar() {
    const response = await fetch("/api/profile/avatar", { method: "DELETE" });
    const payload = (await response.json()) as { profile?: Profile; error?: { message?: string } };
    if (!response.ok || !payload.profile) {
      setError(payload.error?.message ?? "头像删除失败。");
      return;
    }
    setProfile(payload.profile);
    setMessage("已恢复默认头像。");
  }

  return (
    <main className="account-page">
      <h1>个人资料</h1>
      {profile && <Image src={`/api/profile/avatar?v=${profile.avatarPath ?? profile.avatarSeed}`} alt="当前头像" width={128} height={128} unoptimized />}
      <form onSubmit={save}>
        <label>昵称<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={32} required /></label>
        <button type="submit">保存昵称</button>
      </form>
      <label>上传头像<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label>
      <button type="button" onClick={removeAvatar}>恢复默认头像</button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p><Link href="/analyze">返回诊断</Link> · <Link href="/history">查看历史</Link></p>
    </main>
  );
}
