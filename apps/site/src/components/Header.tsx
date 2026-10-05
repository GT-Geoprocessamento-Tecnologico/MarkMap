import { useEffect, useState } from "react";
import { Brand } from "./Brand";

const nav = [
  ["/produto", "Produto"],
  ["/offline", "Offline"],
  ["/baixar", "Baixar app"],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header className={"site-header" + (scrolled ? " is-scrolled" : "")}>
      <div className="site-container site-header__inner">
        <a href="/" className="site-header__brand" aria-label="MarkMap — página inicial">
          <Brand inverse />
        </a>

        <nav className="site-header__nav" aria-label="Principal">
          {nav.map(([href, label]) => (
            <a key={href} href={href} aria-current={path === href ? "page" : undefined}>
              {label}
            </a>
          ))}
          <a href="/baixar" className="button button--primary button--small">Baixar app</a>
        </nav>

        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Menu móvel">
          <div className="site-container mobile-menu__inner">
            <a href="/" onClick={() => setOpen(false)}>Início</a>
            {nav.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
            ))}
            <a href="/baixar" className="button button--primary" onClick={() => setOpen(false)}>Baixar app</a>
          </div>
        </nav>
      )}
    </header>
  );
}
