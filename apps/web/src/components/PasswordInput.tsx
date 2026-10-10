"use client";

import { useState } from "react";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  showLabel: string;
  hideLabel: string;
};

/** Password field with a show/hide toggle (helpful for people who mistype on small keyboards). */
export function PasswordInput({ id, label, value, onChange, autoComplete, showLabel, hideLabel }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-row">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          dir="ltr"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={128}
          required
        />
        <button type="button" className="btn" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? hideLabel : showLabel}
        </button>
      </div>
    </div>
  );
}
