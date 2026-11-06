"use client";

import { useActionState, useState } from "react";
import type { AuthFormState } from "@shared/auth";
import { registerAction } from "@/lib/auth-actions";
import { ArrowRightIcon } from "@/components/brand/icons";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-[18px]">
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-2">
          <label htmlFor="name" className="label">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alex Morgan"
            className="field"
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-2">
          <label htmlFor="teamName" className="label">
            Team name
          </label>
          <input
            id="teamName"
            name="teamName"
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            placeholder="Acme Ops"
            className="field"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="label">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="field"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="label">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            className="field pr-[76px]"
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute right-2 top-2 h-9 rounded-lg px-3 text-sm font-semibold text-[#14151A] transition-colors hover:bg-[#F1F0EB]"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="animate-fade rounded-xl border border-[#F2C5C0] bg-[#FDE8E6] px-3.5 py-2.5 text-sm text-[#B42318]"
        >
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-dark btn-lg mt-1.5 w-full">
        {pending ? "Creating account..." : "Create account"}
        {!pending ? <ArrowRightIcon size={16} className="text-[#C8F23B]" /> : null}
      </button>

      <p className="text-center text-[13px] leading-[1.55] text-[#7A7E8C]">
        By creating an account you agree to the Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}