"use client";

import {
  THEME_OPTIONS,
  type ThemePreference,
} from "@/lib/workspace-config";

export function ThemeControl({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  return (
    <label className="workspace-theme-control">
      <span>主题</span>
      <select
        value={value}
        aria-label="页面主题"
        onChange={(event) =>
          onChange(event.target.value as ThemePreference)
        }
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
