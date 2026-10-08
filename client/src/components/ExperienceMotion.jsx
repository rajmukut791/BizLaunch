import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
export default function ExperienceMotion() {
  const { pathname } = useLocation();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    const hero = document.querySelector('.hero');
    const move = (event) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty('--pointer-x', ((event.clientX - rect.left) / rect.width) * 100 + '%');
      hero.style.setProperty('--pointer-y', ((event.clientY - rect.top) / rect.height) * 100 + '%');
    };
    hero?.addEventListener('pointermove', move, { passive: true });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    const mutation = new MutationObserver(() => observe());
    function observe() {
      document
        .querySelectorAll('.product-card, .stat-card, .auth-form')
        .forEach((element, index) => {
          if (element.classList.contains('reveal')) return;
          element.classList.add('reveal');
          element.style.setProperty('--reveal-delay', (index % 4) * 35 + 'ms');
          observer.observe(element);
        });
    }
    observe();
    mutation.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
      hero?.removeEventListener('pointermove', move);
      document
        .querySelectorAll('.reveal')
        .forEach((element) => element.classList.remove('reveal', 'in-view'));
    };
  }, [pathname]);
  return null;
}
