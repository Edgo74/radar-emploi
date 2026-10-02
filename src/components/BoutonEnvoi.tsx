"use client";

import { useFormStatus } from "react-dom";

export function BoutonEnvoi({ children, enCours, className }: { children: React.ReactNode; enCours: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? enCours : children}
    </button>
  );
}
