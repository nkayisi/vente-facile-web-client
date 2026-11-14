import { describe, expect, it } from "vitest";

import { chargeDuJeton } from "./charge-du-jeton";
import { cleDeSession, estSessionFermee, signalDeCetteSession } from "./signal-session-fermee";

/** Un JWT dont seule la charge compte : la signature n'est jamais lue ici. */
function jeton(charge: Record<string, unknown>): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "HS256" })}.${b64url(charge)}.signature`;
}

const COMPTE = "3f2a9c1e-8b44-4c21-9f0e-7a1d5b2c9d10";

describe("chargeDuJeton", () => {
  it("lit la charge d'un jeton base64url sans remplissage", () => {
    // Cette charge s'encode avec des `-` (que `atob` refuse sans conversion) et
    // une longueur qui n'est pas un multiple de quatre (aucun remplissage).
    expect(chargeDuJeton(jeton({ user_id: COMPTE, note: "~~~?>" }))).toMatchObject({ note: "~~~?>" });
  });

  it("rend null pour ce qui n'est pas un jeton", () => {
    expect(chargeDuJeton(undefined)).toBeNull();
    expect(chargeDuJeton("pas-un-jeton")).toBeNull();
    expect(chargeDuJeton("a.%%%.c")).toBeNull();
    expect(chargeDuJeton(`a.${Buffer.from("[1,2]").toString("base64")}.c`)).toBeNull();
  });
});

describe("estSessionFermee", () => {
  it("reconnaît le code, en objet comme en octets d'un export", () => {
    const corps = { detail: "…", code: "session_revoked" };
    expect(estSessionFermee(corps)).toBe(true);
    expect(estSessionFermee(new TextEncoder().encode(JSON.stringify(corps)))).toBe(true);
  });

  it("ne prend pas un autre 401 pour une session coupée", () => {
    expect(estSessionFermee({ detail: "Token is invalid", code: "token_not_valid" })).toBe(false);
    expect(estSessionFermee({ detail: "La prise en main est terminée." })).toBe(false);
    expect(estSessionFermee(null)).toBe(false);
  });
});

describe("cleDeSession", () => {
  it("désigne le compte et la marque", () => {
    expect(cleDeSession(jeton({ user_id: COMPTE, srv: 1794648612345678 }))).toBe(`${COMPTE}:1794648612345678`);
    expect(cleDeSession(jeton({ user_id: COMPTE }))).toBe(`${COMPTE}:-`);
    expect(cleDeSession(jeton({ srv: 1 }))).toBeNull();
  });

  it("garde la même clé quand le jeton tourne, pas quand la session change", () => {
    const avant = jeton({ user_id: COMPTE, jti: "a", srv: 10 });
    const rafraichi = jeton({ user_id: COMPTE, jti: "b", srv: 10 });
    const apresReconnexion = jeton({ user_id: COMPTE, jti: "c", srv: 11 });
    const signal = cleDeSession(avant);
    expect(signalDeCetteSession(signal, rafraichi)).toBe(true);
    // La session ouverte après la coupure ne doit pas être déconnectée par un
    // signal resté posé.
    expect(signalDeCetteSession(signal, apresReconnexion)).toBe(false);
    expect(signalDeCetteSession(signal, jeton({ user_id: "autre", srv: 10 }))).toBe(false);
    expect(signalDeCetteSession(null, avant)).toBe(false);
  });
});
