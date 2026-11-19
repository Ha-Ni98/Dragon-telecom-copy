import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContentLocale } from "@dragon-telecom/contract";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { usePublicHeroSlides } from "@/hooks/usePlatform";
import { HERO_AUTOPLAY_MS, HERO_SWITCH_MEDIA } from "@/config/constants";
import { cn } from "@/lib/utils";

// ~45% of the viewport height (the set: 40–50%), so the category row and the first products sit
// on the first screen — the audit's main complaint about the reference site was a hero that
// pushed everything below the fold. svh, not vh: mobile browser chrome must not resize it.
const HERO_HEIGHT = "h-[45svh] min-h-[16rem] max-h-[40rem]";

// Reduced motion is read live: the OS setting can change while the page is open.
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return hidden;
}

// S38 — the home hero: up to 5 live slides from the platform module (active, inside their window,
// by displayOrder). Replaces the static HeroSection.
// - No live slide (or a failed fetch) renders NOTHING — the home page then starts with the
//   categories (PUB-01: an empty section hides itself).
// - <picture>: the desktop banner from md up, the square mobile one below. The slide text is real
//   text over a scrim (translatable, selectable, sharp on every display) — the <img> is
//   decorative, alt="".
// - Lazy loading: slide 1 is eager + high priority. Every other slide's <img> is not even in the
//   DOM until the first image has loaded, and then only the slides next to the current one are
//   added — the first paint never waits on images it will not show.
// - Autoplay every HERO_AUTOPLAY_MS, paused while the pointer/focus is inside, while the tab is
//   hidden, and off entirely under prefers-reduced-motion. Swipe is Embla's default drag. Dots,
//   arrows and autoplay all disappear when only one slide is live.
// Embla is used directly (embla-carousel-react is already installed): ui/carousel.tsx hardcodes
// English labels and has no consumers. The call-to-action stays the blue primary button — the
// brand accent is never used on a primary button; only the dots carry it.
export function HeroSlider() {
  const { t, language } = useTranslation();
  const { data: slides = [], isLoading, isError } = usePublicHeroSlides();
  const count = slides.length;

  const [emblaRef, api] = useEmblaCarousel({ loop: count > 1, align: "start" });
  const [selected, setSelected] = useState(0);
  const [firstLoaded, setFirstLoaded] = useState(false);
  const [rendered, setRendered] = useState<ReadonlySet<number>>(new Set([0]));
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const documentHidden = useDocumentHidden();

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  // Which slide <img>s exist. The selected one always; its neighbours (wrapping, the loop) only
  // once the first image is in, so the initial request is slide 1 alone. Never un-rendered.
  useEffect(() => {
    if (count === 0) return;
    const wanted = [selected];
    if (firstLoaded) wanted.push((selected + 1) % count, (selected - 1 + count) % count);
    setRendered((prev) => {
      if (wanted.every((index) => prev.has(index))) return prev;
      return new Set([...prev, ...wanted]);
    });
  }, [selected, firstLoaded, count]);

  useEffect(() => {
    if (!api || count < 2 || paused || documentHidden || reducedMotion) return;
    const id = window.setInterval(() => api.scrollNext(), HERO_AUTOPLAY_MS);
    return () => window.clearInterval(id);
    // `selected` restarts the clock after a manual swipe / dot / arrow, so a slide is never cut
    // short right after the visitor moved it themselves.
  }, [api, count, paused, documentHidden, reducedMotion, selected]);

  if (isLoading) return <Skeleton className={cn("w-full rounded-none", HERO_HEIGHT)} />;
  if (isError || count === 0) return null;

  const locale = language === "en" ? ContentLocale.EN : ContentLocale.FR;

  return (
    <section
      aria-roledescription={t("home.hero.roleDescription")}
      aria-label={t("home.hero.label")}
      className="relative w-full overflow-hidden bg-muted"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, index) => {
            const text = slide.text[locale];
            const internal = slide.link.startsWith("/");
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription={t("home.hero.slide")}
                aria-label={t("home.hero.slideOf", { n: index + 1, total: count })}
                className={cn("relative min-w-0 shrink-0 grow-0 basis-full", HERO_HEIGHT)}
              >
                {(index === 0 || rendered.has(index)) && (
                  <picture>
                    <source media={HERO_SWITCH_MEDIA} srcSet={slide.desktopImageUrl} />
                    <img
                      src={slide.mobileImageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      decoding="async"
                      onLoad={index === 0 ? () => setFirstLoaded(true) : undefined}
                      onError={index === 0 ? () => setFirstLoaded(true) : undefined}
                    />
                  </picture>
                )}
                {/* Scrim: keeps the white title readable over any photo, in both themes. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent md:bg-gradient-to-r md:from-black/65 md:via-black/30"
                />
                <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end gap-4 px-4 pb-12 md:justify-center md:pb-0">
                  <h2 className="max-w-xl text-2xl font-bold leading-tight text-white [overflow-wrap:anywhere] sm:text-3xl md:text-5xl">
                    {text.title}
                  </h2>
                  <div>
                    <Button asChild size="lg">
                      {internal ? (
                        <Link to={slide.link}>{text.ctaLabel}</Link>
                      ) : (
                        <a href={slide.link} target="_blank" rel="noopener noreferrer">
                          {text.ctaLabel}
                        </a>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {count > 1 && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full md:inline-flex"
            aria-label={t("home.hero.previous")}
            onClick={() => api?.scrollPrev()}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full md:inline-flex"
            aria-label={t("home.hero.next")}
            onClick={() => api?.scrollNext()}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* The brand highlight carries the active dot (S37 §0.5). The button is the tap target
              (24px high); the pill inside is the visual. */}
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className="flex h-6 items-center px-1"
                aria-label={t("home.hero.goToSlide", { n: index + 1 })}
                aria-current={index === selected ? "true" : undefined}
                onClick={() => api?.scrollTo(index)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-2 rounded-full transition-all",
                    index === selected ? "w-6 bg-highlight" : "w-2 bg-white/70 hover:bg-white",
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
