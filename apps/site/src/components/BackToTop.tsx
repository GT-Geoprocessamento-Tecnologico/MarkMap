import { useEffect, useState } from "react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [nearFooter, setNearFooter] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const footerBottom = document.querySelector(".site-footer__bottom");
    if (!footerBottom) return;

    const observer = new IntersectionObserver(
      ([entry]) => setNearFooter(Boolean(entry?.isIntersecting)),
      { threshold: 0.05 },
    );
    observer.observe(footerBottom);
    return () => observer.disconnect();
  }, []);

  const handleClick = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      className={
        "back-to-top" +
        (visible ? " is-visible" : "") +
        (nearFooter ? " is-near-footer" : "")
      }
      onClick={handleClick}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
