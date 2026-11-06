"use client";

import { useActionState, useState } from "react";
import type { AuthFormState } from "@shared/auth";
import { loginAction } from "@/lib/auth-actions";
import { ArrowRightIcon } from "@/components/brand/icons";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <form action={formAction} className="mt-9 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="label">
          Email
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
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="label">
            Password
          </label>
          <span
            className="cursor-default text-sm font-medium text-[#5C6070] underline decoration-[#5C6070]/40 underline-offset-2"
            title="Password reset is not available in this local build"
          >
            Forgot password?
          </span>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
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

      <button type="submit" disabled={pending} className="btn btn-dark btn-lg mt-1 w-full">
        {pending ? "Signing in..." : "Sign in"}
        {!pending ? <ArrowRightIcon size={16} className="text-[#C8F23B]" /> : null}
      </button>
    </form>
  );
}