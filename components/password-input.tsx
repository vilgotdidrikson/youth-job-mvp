"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { UiIcon } from "@/components/ui-icon";
import styles from "./password-input.module.css";

export function PasswordInput({ id, style, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return <span className={styles.field}>
    <input {...props} id={inputId} type={visible ? "text" : "password"} style={{ ...style, paddingRight: "3.5rem" }} />
    <button type="button" className={styles.toggle} disabled={props.disabled}
      aria-label={visible ? "Dölj lösenord" : "Visa lösenord"} aria-controls={inputId}
      aria-pressed={visible} onClick={() => setVisible(current => !current)}>
      <UiIcon name={visible ? "eye-off" : "eye"} />
    </button>
  </span>;
}
