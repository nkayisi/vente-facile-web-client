import { describe, expect, it } from "vitest";

import { lireToutesLesPages } from "./pages";

const enveloppes = (pages: string[][]) => (page: number) =>
  Promise.resolve({
    results: pages[page - 1] ?? [],
    next: page < pages.length ? `https://ailleurs/?page=${page + 1}` : null,
  });

describe("lireToutesLesPages", () => {
  it("va au-delà de la première page", async () => {
    const tout = await lireToutesLesPages(enveloppes([["a", "b"], ["c"], ["d"]]), { pagesMax: 20 });
    expect(tout).toEqual(["a", "b", "c", "d"]);
  });

  it("s'arrête quand il n'y a plus de page suivante", async () => {
    const lues: number[] = [];
    await lireToutesLesPages(
      (page) => {
        lues.push(page);
        return enveloppes([["a"], ["b"]])(page);
      },
      { pagesMax: 20 },
    );
    expect(lues).toEqual([1, 2]);
  });

  it("ne lit qu'une page quand on le demande", async () => {
    const tout = await lireToutesLesPages(enveloppes([["a"], ["b"]]), { pagesMax: 20, unePage: true });
    expect(tout).toEqual(["a"]);
  });

  it("rend une liste nue telle quelle", async () => {
    const tout = await lireToutesLesPages(() => Promise.resolve(["x", "y"]), { pagesMax: 20 });
    expect(tout).toEqual(["x", "y"]);
  });

  it("borne un serveur qui annonce toujours une suite", async () => {
    let appels = 0;
    const tout = await lireToutesLesPages(
      () => {
        appels++;
        return Promise.resolve({ results: ["z"], next: "encore" });
      },
      { pagesMax: 3 },
    );
    expect(appels).toBe(3);
    expect(tout).toEqual(["z", "z", "z"]);
  });
});
