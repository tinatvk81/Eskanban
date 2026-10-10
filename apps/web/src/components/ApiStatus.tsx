"use client";

import { useEffect, useState } from "react";

type State = "checking" | "ok" | "down";

type Props = {
  title: string;
  webLabel: string;
  apiLabel: string;
  okLabel: string;
  downLabel: string;
  checkingLabel: string;
};

export function ApiStatus(props: Props) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const controller = new AbortController();
    // Asks our own server, which asks the backend: the browser never talks to the API directly.
    fetch("/api/health", { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { api?: string }) => setState(body.api === "ok" ? "ok" : "down"))
      .catch(() => {
        if (!controller.signal.aborted) setState("down");
      });
    return () => controller.abort();
  }, []);

  const text = state === "ok" ? props.okLabel : state === "down" ? props.downLabel : props.checkingLabel;

  return (
    <section className="card" aria-live="polite">
      <h2>{props.title}</h2>
      <div className="status-row">
        <span>{props.webLabel}</span>
        <span className="badge" data-state="ok">
          <span className="dot" />
          {props.okLabel}
        </span>
      </div>
      <div className="status-row">
        <span>{props.apiLabel}</span>
        <span className="badge" data-state={state}>
          <span className="dot" />
          {text}
        </span>
      </div>
    </section>
  );
}
