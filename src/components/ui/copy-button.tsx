"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/brand/icons";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "btn btn-outline btn-xs",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={() => void copy()} className={className}>
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      <span className="transition-opacity">{copied ? copiedLabel : label}</span>
    </button>
  );
}