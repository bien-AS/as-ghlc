"use client";

import { useEffect, useRef } from "react";

/**
 * Tells CSS whether its subtree is on screen, through `data-inview`.
 *
 * `once` (the default) is for a reveal: content that is below the fold when
 * the page loads is marked "false", then "true" the first time it scrolls in.
 * Content already on screen, a browser without IntersectionObserver, no
 * JavaScript, and reduced motion all leave the attribute off, so the server's
 * fully visible markup is what shows. Style children with `data-reveal`
 * (see src/app/marketing.css).
 *
 * `once={false}` keeps the attribute in step with visibility, for pausing a
 * looping animation while it is off screen.
 */
function InView({
  once = true,
  ...props
}: React.ComponentProps<"div"> & { once?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (once) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (el.getBoundingClientRect().top < window.innerHeight) return;
    }
    el.dataset.inview = "false";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (once && !entry.isIntersecting) return;
        el.dataset.inview = String(entry.isIntersecting);
        if (once) observer.disconnect();
      },
      // A reveal waits until the content is a little way into the viewport.
      { rootMargin: once ? "0px 0px -12% 0px" : "0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  return <div ref={ref} data-slot="in-view" {...props} />;
}

export { InView };
