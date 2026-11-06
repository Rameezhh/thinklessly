import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { SignInBrand } from "@/components/auth/sign-in-brand";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell
      brandSide="right"
      brand={<SignInBrand />}
      form={
        <div className="flex h-full flex-col">
          <Link href="/" aria-label="Thinklessly home" className="self-start">
            <Logo variant="ink" size={34} wordmarkSize={22} />
          </Link>

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="animate-rise w-full max-w-[420px]">
              <h1 className="display text-[40px] leading-[1.05] sm:text-[44px]">Welcome back</h1>
              <p className="mt-3 text-base leading-[1.55] text-[#5C6070]">
                Sign in to your team space to run and manage your automations.
              </p>

              <LoginForm />

              <p className="mt-7 text-center text-[15px] text-[#5C6070]">
                New to Thinklessly?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-[#14151A] underline underline-offset-2"
                >
                  Create an account
                </Link>
              </p>

              <p className="mono mt-6 rounded-xl bg-[#F1F0EB] px-3.5 py-2.5 text-center text-[12px] text-[#5C6070]">
                Demo · demo@local.test / password123
              </p>
            </div>
          </div>

          <div className="text-[13px] text-[#7A7E8C]">© 2026 Thinklessly</div>
        </div>
      }
    />
  );
}