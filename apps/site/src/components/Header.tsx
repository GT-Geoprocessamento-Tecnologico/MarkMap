import { useEffect, useState } from "react";
import { Brand } from "./Brand";

const nav = [
  ["#recursos", "Recursos"],
  ["#como-funciona", "Como funciona"],
  ["#plataformas", "Plataformas"],
  ["#seguranca", "Segurança"],
  ["#faq", "FAQ"],
] as const;

export function Header({ home = true }: { home?: boolean }) {
  const [open, setOpen] = useState(false);
  const href = (anchor: string) => (home ? anchor : `/${anchor}`);

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
    <header className="site-header">
      <div className="site-container site-header__inner">
        <a href="/" className="site-header__brand" aria-label="MarkMap — página inicial"><Brand /></a>
        <nav className="site-header__nav" aria-label="Principal">
          {nav.map(([target, label]) => <a key={target} href={href(target)}>{label}</a>)}
          <a href={href("#plataformas")} className="button button--dark button--small">Ver plataformas</a>
        </nav>
        <button className="menu-button" type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen((value) => !value)}>
          <span /> <span />
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Menu móvel">
          <div className="site-container mobile-menu__inner">
            {nav.map(([target, label]) => <a key={target} href={href(target)} onClick={() => setOpen(false)}>{label}</a>)}
            <a href={href("#plataformas")} className="button button--primary" onClick={() => setOpen(false)}>Ver plataformas</a>
          </div>
        </nav>
      )}
    </header>
  );
}
