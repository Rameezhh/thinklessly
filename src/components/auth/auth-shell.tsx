import type { ReactNode } from "react";

export function AuthShell({
  form,
  brand,
  brandSide = "right",
}: {
  form: ReactNode;
  brand: ReactNode;
  brandSide?: "left" | "right";
}) {
  const formOrder = brandSide === "left" ? "lg:order-2" : "lg:order-1";
  const brandOrder = brandSide === "left" ? "lg:order-1" : "lg:order-2";

  return (
    <div className="flex min-h-screen flex-wrap bg-[#F7F7F4]">
      <section
        className={`order-1 flex min-w-0 flex-[1_1_520px] flex-col px-6 py-8 sm:px-12 sm:py-10 ${formOrder}`}
      >
        {form}
      </section>
      <section
        className={`order-2 flex min-w-0 flex-[1_1_520px] flex-col bg-[#0E0F13] ${brandOrder}`}
      >
        {brand}
      </section>
    </div>
  );
}