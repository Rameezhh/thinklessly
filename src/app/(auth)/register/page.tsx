import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { SignUpBrand } from "@/components/auth/sign-up-brand";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <AuthShell
      brandSide="left"
      brand={<SignUpBrand />}
      form={
        <div className="flex h-full flex-col items-center justify-center">
          <div className="animate-rise w-full max-w-[440px] py-6">
            <h1 className="display text-[40px] leading-[1.05] sm:text-[44px]">
              Create your account
            </h1>
            <p className="mt-3 text-base leading-[1.55] text-[#5C6070]">
              Set up your team space and record your first automation.
            </p>

            <RegisterForm />

            <p className="mt-6 text-center text-[15px] text-[#5C6070]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#14151A] underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      }
    />
  );
}