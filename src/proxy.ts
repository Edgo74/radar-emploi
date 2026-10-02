import { NextResponse, type NextRequest } from "next/server";

// Le site contient tes candidatures : tout est protégé par un mot de passe (Basic Auth).
// La route du cron a sa propre protection (CRON_SECRET), elle est donc exclue ici.
export function proxy(request: NextRequest) {
  const motDePasse = process.env.SITE_PASSWORD;
  if (!motDePasse) return new NextResponse("SITE_PASSWORD non configuré", { status: 500 });

  const header = request.headers.get("authorization") ?? "";
  const [type, encode] = header.split(" ");
  if (type === "Basic" && encode) {
    const [, saisi] = atob(encode).split(":");
    if (saisi === motDePasse) return NextResponse.next();
  }
  return new NextResponse("Mot de passe requis", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Radar emploi", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
