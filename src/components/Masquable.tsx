"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { changerEtape } from "@/app/actions";
import type { Etape } from "@/lib/supabase";

// Une carte qui change d'étape quitte l'onglet affiché : on la cache dès le clic,
// la base est mise à jour en arrière-plan, et la carte revient si l'enregistrement échoue.
const Ctx = createContext<{ masquer: () => void; afficher: () => void } | null>(null);

export function Masquable({ children, actif = true }: { children: React.ReactNode; actif?: boolean }) {
  const [cache, setCache] = useState(false);
  if (cache) return null;
  return <Ctx.Provider value={{ masquer: () => actif && setCache(true), afficher: () => setCache(false) }}>{children}</Ctx.Provider>;
}

export function BoutonDeplacer({ id, etape, children, className }: { id: string; etape: Etape; children: React.ReactNode; className?: string }) {
  const ctx = useContext(Ctx);
  const [enCours, demarrer] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={enCours}
      onClick={() => {
        ctx?.masquer();
        demarrer(async () => {
          try {
            await changerEtape(id, etape);
          } catch {
            ctx?.afficher();
            alert("L'offre n'a pas pu être déplacée. Réessaie.");
          }
        });
      }}
    >
      {enCours ? "…" : children}
    </button>
  );
}
