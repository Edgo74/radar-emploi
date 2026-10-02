"use client";

import { useState } from "react";

export function BoutonCopier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      className="bouton discret"
      onClick={async () => {
        await navigator.clipboard.writeText(texte);
        setCopie(true);
        setTimeout(() => setCopie(false), 1500);
      }}
    >
      {copie ? "Copié" : "Copier les 3 lignes"}
    </button>
  );
}
