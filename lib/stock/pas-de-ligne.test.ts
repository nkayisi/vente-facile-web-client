import { describe, expect, it } from "vitest";

import { pasDeLigne } from "./pas-de-ligne";

describe("pasDeLigne", () => {
  it("sous l'unité, le pas est le demi : « − » sur 1,5 ne vide pas la ligne", () => {
    expect(pasDeLigne(0.5)).toBe(0.5);
    expect(pasDeLigne(1.5)).toBe(1);
    expect(1.5 - pasDeLigne(1.5)).toBe(0.5);
  });

  it("une valeur illisible ou nulle avance de 1", () => {
    expect(pasDeLigne(0)).toBe(1);
    expect(pasDeLigne(Number.NaN)).toBe(1);
  });
});
