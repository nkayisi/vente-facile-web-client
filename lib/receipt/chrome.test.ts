import { describe, expect, it } from "vitest";
import { buildOrgIdentity, chromeDeSecours } from "./chrome";
import type { LoadedLogo } from "./identity";

const LOGO_MARCHAND: LoadedLogo = { dataUrl: "data:image/png;base64,AAA", format: "PNG", aspectRatio: 1 };
const LOGO_PLATEFORME: LoadedLogo = { dataUrl: "data:image/png;base64,BBB", format: "PNG", aspectRatio: 0.7 };

const organisation = {
  name: "Boutique Kalume",
  logo: undefined,
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
};

describe("logo du reçu", () => {
  it("imprime celui de l'établissement quand il est chargé", () => {
    const identite = buildOrgIdentity({
      organization: organisation,
      logo: LOGO_MARCHAND,
      logoPlateforme: LOGO_PLATEFORME,
    });
    expect(identite.logo).toBe(LOGO_MARCHAND);
  });

  it("imprime celui de Vente Facile quand l'établissement n'en a pas", () => {
    const identite = buildOrgIdentity({
      organization: organisation,
      logo: null,
      logoPlateforme: LOGO_PLATEFORME,
    });
    expect(identite.logo).toBe(LOGO_PLATEFORME);
  });

  it("n'invente rien quand aucun des deux n'est chargé", () => {
    const identite = buildOrgIdentity({ organization: organisation, logo: null });
    expect(identite.logo).toBeUndefined();
  });

  it("le reçu de secours porte aussi le logo de la plateforme", () => {
    const chrome = chromeDeSecours("Boutique Kalume", LOGO_PLATEFORME);
    expect(chrome.org.name).toBe("Boutique Kalume");
    expect(chrome.org.logo).toBe(LOGO_PLATEFORME);
  });
});
