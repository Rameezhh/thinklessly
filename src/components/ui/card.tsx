import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`card ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card-head ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`card-title ${className}`} {...props} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`card-desc ${className}`} {...props} />;
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card-body ${className}`} {...props} />;
}

export function CardFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card-foot ${className}`} {...props} />;
}