import { describe, expect, it } from "vitest";
import {
  calculateServerTotal,
  getCatalogLine,
  productCatalog,
  sanitizeCart,
} from "@shared/catalog";

describe("catalog security rules", () => {
  it("preserves the exact product image sources provided for each variant", () => {
    expect(productCatalog.variants.Preto[0]?.src).toBe("https://i.postimg.cc/26s1r0F3/inow-preta.png");
    expect(productCatalog.variants.Caramelo.map((image) => image.src)).toEqual([
      "https://i.postimg.cc/QMM9b9dX/inow-caramelo-2.webp",
      "https://i.postimg.cc/QxRTjxmT/inow-caramelo.webp",
    ]);
  });

  it("recalculates the total using the server catalog price", () => {
    const total = calculateServerTotal([
      { productId: "inow-1000w", variant: "Caramelo", quantity: 2 },
    ]);
    expect(total).toBe(310000);
  });

  it("does not include an unknown product in the server total", () => {
    const total = calculateServerTotal([
      { productId: "unknown", variant: "Preto", quantity: 1 },
    ]);
    expect(total).toBe(0);
  });

  it("normalizes valid cart lines and discards malformed values", () => {
    const sanitized = sanitizeCart([
      getCatalogLine("Preto", 1),
      { productId: "inow-1000w", variant: "Caramelo", quantity: 2 },
      { productId: "inow-1000w", variant: "Azul", quantity: 1 },
      { productId: "inow-1000w", variant: "Preto", quantity: 99 },
    ]);
    expect(sanitized).toEqual([
      { productId: "inow-1000w", variant: "Preto", quantity: 1 },
      { productId: "inow-1000w", variant: "Caramelo", quantity: 2 },
    ]);
  });
});
