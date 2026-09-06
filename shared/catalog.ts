export const PRODUCT_ID = "inow-1000w" as const;
export type ProductVariant = "Preto" | "Caramelo";

export type GalleryImage = { src: string; alt: string };

export type ProductCatalogItem = {
  id: typeof PRODUCT_ID;
  name: string;
  slug: string;
  description: string;
  originalPriceCents: number;
  promotionalPriceCents: number;
  variants: Record<ProductVariant, GalleryImage[]>;
  specifications: Array<{ label: string; value: string }>;
};

export const productCatalog: ProductCatalogItem = {
  id: PRODUCT_ID,
  name: "Bicicleta Elétrica INOW 1000W",
  slug: "bicicleta-eletrica-inow-1000w",
  description:
    "Motor com 1000 W de potência que permite atingir velocidade máxima de 45 km/h para deslocamentos rápidos na cidade.",
  originalPriceCents: 669999,
  promotionalPriceCents: 359990,
  variants: {
    Preto: [
      {
        src: "https://i.postimg.cc/26s1r0F3/inow-preta.png",
        alt: "Bicicleta elétrica INOW 1000W na cor preta",
      },
    ],
    Caramelo: [
      {
        src: "https://i.postimg.cc/QMM9b9dX/inow-caramelo-2.webp",
        alt: "Bicicleta elétrica INOW 1000W na cor caramelo, vista principal",
      },
      {
        src: "https://i.postimg.cc/QxRTjxmT/inow-caramelo.webp",
        alt: "Bicicleta elétrica INOW 1000W na cor caramelo, vista adicional",
      },
    ],
  },
  specifications: [
    { label: "Motor", value: "1000 W" },
    { label: "Velocidade máxima", value: "45 km/h" },
    { label: "Bateria", value: "Íon de lítio 48V / 15.6 Ah" },
    { label: "Aro", value: "20" },
    { label: "Capacidade", value: "Até 200 kg de peso total" },
  ],
};

export const variantList: ProductVariant[] = ["Preto", "Caramelo"];
export const STORE_NAME = "Lexus Elétricos";
export const CART_STORAGE_KEY = "lexus-eletricos-cart-v1";
export const META_PIXEL_ID = "1724233682208521";
export const SUPABASE_CALLBACK_URL =
  "https://rfbnsagqhbnkmvzcqxvs.supabase.co/auth/v1/callback";
export const cartMaxQuantity = 10;

export type CartLine = {
  productId: typeof PRODUCT_ID;
  variant: ProductVariant;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function isProductVariant(value: unknown): value is ProductVariant {
  return value === "Preto" || value === "Caramelo";
}

export function isSafeQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= cartMaxQuantity;
}

export function getCatalogLine(variant: ProductVariant, quantity: number): CartLine {
  const safeQuantity = Math.min(cartMaxQuantity, Math.max(1, Math.floor(quantity)));
  return {
    productId: PRODUCT_ID,
    variant,
    quantity: safeQuantity,
    unitPriceCents: productCatalog.promotionalPriceCents,
    totalCents: productCatalog.promotionalPriceCents * safeQuantity,
  };
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (line): line is Pick<CartLine, "productId" | "variant" | "quantity"> =>
          line?.productId === PRODUCT_ID &&
          isProductVariant(line.variant) &&
          isSafeQuantity(line.quantity),
      )
      .map((line) => getCatalogLine(line.variant, line.quantity));
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent("lexus-cart-updated"));
}

export function upsertCartLine(lines: CartLine[], variant: ProductVariant, quantity = 1) {
  const existing = lines.find((line) => line.productId === PRODUCT_ID && line.variant === variant);
  if (!existing) return [...lines, getCatalogLine(variant, quantity)];
  return lines.map((line) =>
    line === existing ? getCatalogLine(variant, line.quantity + quantity) : line,
  );
}

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.totalCents, 0);
}

export function cartQuantity(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function getCartLineKey(line: Pick<CartLine, "productId" | "variant">) {
  return `${line.productId}:${line.variant}`;
}

export function sanitizeCart(lines: unknown): Array<Pick<CartLine, "productId" | "variant" | "quantity">> {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter(
      (line): line is Pick<CartLine, "productId" | "variant" | "quantity"> =>
        Boolean(line) &&
        typeof line === "object" &&
        (line as CartLine).productId === PRODUCT_ID &&
        isProductVariant((line as CartLine).variant) &&
        isSafeQuantity((line as CartLine).quantity),
    )
    .map(({ productId, variant, quantity }) => ({ productId, variant, quantity }));
}

export function calculateServerTotal(
  lines: Array<{ productId: string; variant: ProductVariant; quantity: number }>,
) {
  return lines.reduce((total, line) => {
    if (line.productId !== PRODUCT_ID || !isProductVariant(line.variant) || !isSafeQuantity(line.quantity)) {
      return total;
    }
    return total + productCatalog.promotionalPriceCents * line.quantity;
  }, 0);
}

export const productFacts = [
  "Mobilidade elétrica para deslocamentos urbanos",
  "Estrutura aro 20 com capacidade de até 200 kg de peso total",
  "Bateria de íon de lítio 48V / 15.6 Ah",
];

export const productNotice =
  "A capacidade para passageiro ou carga extra deve respeitar as especificações do fabricante e a legislação aplicável.";

export const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: productCatalog.name,
  description: productCatalog.description,
  brand: { "@type": "Brand", name: STORE_NAME },
  image: Object.values(productCatalog.variants).flat().map((image) => image.src),
  offers: {
    "@type": "Offer",
    priceCurrency: "BRL",
    price: (productCatalog.promotionalPriceCents / 100).toFixed(2),
    availability: "https://schema.org/InStock",
  },
};

export const productPath = `/produto/${productCatalog.slug}`;
export const checkoutPath = "/checkout";
export const accountPath = "/conta";
export const allowedImageUrls = Object.values(productCatalog.variants)
  .flat()
  .map((image) => image.src);

export function getVariantImages(variant: ProductVariant) {
  return productCatalog.variants[variant];
}

export function getServerPriceCents(productId: string, variant: ProductVariant) {
  return productId === PRODUCT_ID && isProductVariant(variant)
    ? productCatalog.promotionalPriceCents
    : null;
}

export default productCatalog;
