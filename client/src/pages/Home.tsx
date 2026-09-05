import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Menu,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
  ZoomIn,
} from "lucide-react";
import {
  STORE_NAME,
  cartQuantity,
  cartTotal,
  formatBRL,
  getCartLineKey,
  getVariantImages,
  productCatalog,
  productFacts,
  productJsonLd,
  productNotice,
  readCart,
  type CartLine,
  type ProductVariant,
  upsertCartLine,
  writeCart,
} from "@shared/catalog";

function Logo() {
  return (
    <Link href="/" className="brand-mark" aria-label="Lexus Elétricos — início">
      <img
        src="https://i.postimg.cc/B6r1zWx7/lexus-logo.jpg"
        alt="Logo Lexus Elétricos"
        className="brand-logo"
        width={42}
        height={42}
      />
      <span className="brand-name">
        <strong>Lexus</strong>
        <span>Elétricos</span>
      </span>
    </Link>
  );
}

function CartDrawer({
  open,
  lines,
  onClose,
  onUpdateQuantity,
  onRemove,
}: {
  open: boolean;
  lines: CartLine[];
  onClose: () => void;
  onUpdateQuantity: (line: CartLine, delta: number) => void;
  onRemove: (line: CartLine) => void;
}) {
  const [, setLocation] = useLocation();
  const total = cartTotal(lines);
  return (
    <>
      {open && <button className="drawer-backdrop" onClick={onClose} aria-label="Fechar carrinho" />}
      <aside className={`cart-drawer ${open ? "is-open" : ""}`} aria-label="Carrinho" aria-hidden={!open}>
        <div className="drawer-header">
          <div>
            <span className="eyebrow">Sua seleção</span>
            <h2>Seu carrinho</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar carrinho">
            <X size={20} />
          </button>
        </div>
        <div className="drawer-content">
          {lines.length === 0 ? (
            <div className="empty-cart">
              <ShoppingBag size={32} strokeWidth={1.4} />
              <h3>Seu carrinho está vazio.</h3>
              <p>Escolha a configuração da sua INOW e comece sua jornada elétrica.</p>
              <button className="button button-dark" onClick={onClose}>Ver produto</button>
            </div>
          ) : (
            <div className="cart-lines">
              {lines.map((line) => {
                const image = getVariantImages(line.variant)[0];
                return (
                  <div className="cart-line" key={getCartLineKey(line)}>
                    <img src={image.src} alt={image.alt} />
                    <div className="cart-line-info">
                      <div className="cart-line-topline">
                        <div>
                          <span className="cart-line-name">INOW 1000W</span>
                          <span className="cart-line-variant">Cor {line.variant}</span>
                        </div>
                        <button className="remove-button" onClick={() => onRemove(line)} aria-label={`Remover INOW ${line.variant}`}>
                          <X size={15} />
                        </button>
                      </div>
                      <strong>{formatBRL(line.unitPriceCents)}</strong>
                      <div className="quantity-stepper" aria-label={`Quantidade, ${line.quantity}`}>
                        <button onClick={() => onUpdateQuantity(line, -1)} aria-label="Diminuir quantidade"><Minus size={14} /></button>
                        <span>{line.quantity}</span>
                        <button onClick={() => onUpdateQuantity(line, 1)} aria-label="Aumentar quantidade"><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {lines.length > 0 && (
          <div className="drawer-footer">
            <div className="drawer-total"><span>Subtotal</span><strong>{formatBRL(total)}</strong></div>
            <p className="muted-note">O valor será validado novamente no servidor antes do pedido.</p>
            <button className="button button-dark button-wide" onClick={() => { onClose(); setLocation("/checkout"); }}>
              Continuar para checkout <ArrowRight size={17} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>("Preto");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [cart, setCart] = useState<CartLine[]>(() => readCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const images = useMemo(() => getVariantImages(selectedVariant), [selectedVariant]);
  const activeImage = images[selectedImageIndex] ?? images[0];
  const quantity = cartQuantity(cart);

  const hasSameCartLines = (left: CartLine[], right: CartLine[]) =>
    left.length === right.length &&
    left.every((line, index) => {
      const next = right[index];
      return (
        next !== undefined &&
        getCartLineKey(line) === getCartLineKey(next) &&
        line.quantity === next.quantity &&
        line.unitPriceCents === next.unitPriceCents &&
        line.totalCents === next.totalCents
      );
    });

  useEffect(() => {
    writeCart(cart);
  }, [cart]);

  useEffect(() => {
    const sync = () => {
      const nextCart = readCart();
      setCart((currentCart) =>
        hasSameCartLines(currentCart, nextCart) ? currentCart : nextCart,
      );
    };
    window.addEventListener("storage", sync);
    window.addEventListener("lexus-cart-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("lexus-cart-updated", sync);
    };
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Bicicleta Elétrica INOW 1000W | Lexus Elétricos";
    const script = (document.getElementById("product-jsonld") as HTMLScriptElement | null) ?? document.createElement("script");
    script.id = "product-jsonld";
    script.setAttribute("type", "application/ld+json");
    script.textContent = JSON.stringify(productJsonLd);
    document.head.appendChild(script);
    return () => {
      document.title = previousTitle;
      script.remove();
    };
  }, []);

  const selectVariant = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setSelectedImageIndex(0);
  };

  const addToCart = () => {
    setCart((current) => upsertCartLine(current, selectedVariant));
    setNotice(`INOW 1000W ${selectedVariant.toLowerCase()} adicionada ao carrinho.`);
    setCartOpen(true);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const updateQuantity = (line: CartLine, delta: number) => {
    setCart((current) => current.flatMap((item) => {
      if (getCartLineKey(item) !== getCartLineKey(line)) return [item];
      const nextQuantity = item.quantity + delta;
      return nextQuantity <= 0 ? [] : [{ ...item, quantity: nextQuantity, totalCents: item.unitPriceCents * nextQuantity }];
    }));
  };

  const removeLine = (line: CartLine) => setCart((current) => current.filter((item) => getCartLineKey(item) !== getCartLineKey(line)));

  const navigateTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="storefront">
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav className={`desktop-nav ${mobileMenuOpen ? "mobile-open" : ""}`} aria-label="Navegação principal">
            <button onClick={() => navigateTo("produto")}>Produto</button>
            <button onClick={() => navigateTo("especificacoes")}>Especificações</button>
            <button onClick={() => navigateTo("como-funciona")}>Como funciona</button>
          </nav>
          <div className="header-actions">
            <button className="account-button" onClick={() => isAuthenticated ? setLocation("/conta") : startLogin()}>
              <CircleUserRound size={19} />
              <span className="account-label">{user?.name?.split(" ")[0] ?? "Entrar"}</span>
            </button>
            <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrinho com ${quantity} itens`}>
              <ShoppingBag size={20} />
              {quantity > 0 && <span className="cart-count">{quantity}</span>}
            </button>
            <button className="menu-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}>
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
      </header>

      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}

      <main>
        <section className="hero-section" id="produto">
          <div className="hero-copy reveal-up">
            <div className="eyebrow eyebrow-accent"><Sparkles size={14} /> INOW 1000W · EDIÇÃO URBANA</div>
            <h1>Mobilidade elétrica.<br /><em>Mais liberdade</em> para a cidade.</h1>
            <p className="hero-lead">Potência, presença e praticidade em uma bicicleta elétrica feita para acompanhar o seu ritmo.</p>
            <div className="hero-actions">
              <button className="button button-dark" onClick={() => navigateTo("comprar")}>Escolher configuração <ArrowRight size={17} /></button>
              <button className="text-button" onClick={() => navigateTo("especificacoes")}>Conhecer a INOW <ChevronDown size={16} /></button>
            </div>
            <div className="hero-meta"><span><span className="meta-dot" /> Motor 1000 W</span><span><span className="meta-dot" /> Até 45 km/h</span><span><span className="meta-dot" /> Aro 20</span></div>
          </div>
          <div className="hero-visual reveal-scale">
            <div className="visual-glow" />
            <img src={activeImage.src} alt={activeImage.alt} fetchPriority="high" />
            <div className="visual-caption"><span>01</span><div><strong>Feita para ir além.</strong><small>Design urbano. Energia inteligente.</small></div></div>
          </div>
        </section>

        <section className="statement-section" id="como-funciona">
          <div className="section-kicker">A cidade em outro ritmo</div>
          <div className="statement-grid"><h2>Uma nova forma de<br /><em>chegar lá.</em></h2><div><p>O sistema de alimentação elétrica elimina a necessidade de combustíveis fósseis e pode reduzir custos de operação e manutenção.</p><button className="arrow-link" onClick={() => navigateTo("especificacoes")}>Ver todos os detalhes <ArrowRight size={16} /></button></div></div>
          <div className="facts-row">{productFacts.map((fact, index) => <div className="fact" key={fact}><span>0{index + 1}</span><p>{fact}</p></div>)}</div>
        </section>

        <section className="product-section" id="comprar">
          <div className="product-gallery reveal-up">
            <div className="gallery-main-wrap">
              <button className="gallery-main" onClick={() => setZoomOpen(true)} aria-label="Ampliar imagem do produto">
                <img src={activeImage.src} alt={activeImage.alt} loading="lazy" />
                <span className="zoom-label"><ZoomIn size={14} /> Ampliar</span>
              </button>
              {images.length > 1 && <><button className="gallery-arrow gallery-prev" onClick={() => setSelectedImageIndex((selectedImageIndex - 1 + images.length) % images.length)} aria-label="Imagem anterior"><ChevronLeft size={19} /></button><button className="gallery-arrow gallery-next" onClick={() => setSelectedImageIndex((selectedImageIndex + 1) % images.length)} aria-label="Próxima imagem"><ChevronRight size={19} /></button></>}
            </div>
            <div className="thumbnail-row" role="tablist" aria-label="Imagens do produto">
              {images.map((image, index) => <button className={`thumbnail ${selectedImageIndex === index ? "selected" : ""}`} key={image.src} onClick={() => setSelectedImageIndex(index)} role="tab" aria-selected={selectedImageIndex === index}><img src={image.src} alt={`Miniatura ${index + 1}: ${image.alt}`} loading="lazy" /></button>)}
            </div>
          </div>
          <div className="purchase-panel reveal-up">
            <div className="eyebrow">Bicicleta elétrica · INOW</div>
            <h2>{productCatalog.name}</h2>
            <p className="product-description">{productCatalog.description}</p>
            <div className="price-block"><span className="price-from">De {formatBRL(productCatalog.originalPriceCents)}</span><div className="price-to"><small>Por</small><strong>{formatBRL(productCatalog.promotionalPriceCents)}</strong></div></div>
            <div className="variant-control"><div className="control-label"><span>Escolha sua cor</span><strong>{selectedVariant}</strong></div><div className="variant-options">{(["Preto", "Caramelo"] as ProductVariant[]).map((variant) => <button key={variant} className={`variant-option ${selectedVariant === variant ? "selected" : ""}`} onClick={() => selectVariant(variant)}><span className={`swatch ${variant.toLowerCase()}`} /><span>{variant}</span>{selectedVariant === variant && <Check size={15} />}</button>)}</div></div>
            <button className="button button-dark button-wide buy-button" onClick={addToCart}>Adicionar ao carrinho <ShoppingBag size={17} /></button>
            <p className="safe-note"><span className="safe-icon">✓</span> Compra protegida com validação do pedido no servidor.</p>
            <div className="purchase-details"><div><span>Entrega</span><strong>Consulte condições no checkout</strong></div><div><span>Configuração</span><strong>INOW 1000W · {selectedVariant}</strong></div></div>
          </div>
        </section>

        <section className="spec-section" id="especificacoes">
          <div className="section-heading"><div><div className="section-kicker">Dados essenciais</div><h2>Potência que você<br /><em>sente.</em></h2></div><p>Informações da Bicicleta Elétrica INOW 1000W conforme as especificações fornecidas.</p></div>
          <div className="spec-grid">{productCatalog.specifications.map((spec) => <div className="spec-card" key={spec.label}><span>{spec.label}</span><strong>{spec.value}</strong></div>)}</div>
          <div className="spec-notice"><span className="notice-line" /><p>{productNotice}</p></div>
        </section>

        <section className="closing-section"><div className="closing-inner"><div className="eyebrow eyebrow-light">Lexus Elétricos</div><h2>Pronto para mudar<br />o seu <em>trajeto?</em></h2><button className="button button-light" onClick={() => navigateTo("comprar")}>Escolher minha INOW <ArrowRight size={17} /></button></div></section>
      </main>

      <footer className="site-footer"><div className="footer-brand"><Logo /><p>Mobilidade elétrica para a cidade.</p></div><div className="footer-links"><span>© 2026 Lexus Elétricos</span><span>Informações técnicas conforme dados fornecidos.</span></div></footer>

      <CartDrawer open={cartOpen} lines={cart} onClose={() => setCartOpen(false)} onUpdateQuantity={updateQuantity} onRemove={removeLine} />
      {zoomOpen && <div className="zoom-overlay" role="dialog" aria-modal="true" aria-label="Imagem ampliada" onClick={() => setZoomOpen(false)}><button className="zoom-close" onClick={() => setZoomOpen(false)} aria-label="Fechar imagem"><X size={22} /></button><img src={activeImage.src} alt={activeImage.alt} onClick={(event) => event.stopPropagation()} /></div>}
    </div>
  );
}
