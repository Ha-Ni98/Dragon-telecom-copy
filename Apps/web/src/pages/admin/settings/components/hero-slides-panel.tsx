import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ContentLocale,
  HERO_SLIDES_MAX,
  HERO_SLIDES_PUBLIC_MAX,
  storeLocalDate,
  type HeroSlideDto,
} from "@dragon-telecom/contract";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { SectionTitle } from "@/components/shared/SectionTitle";
import { StatusPill, type BadgeTone } from "@/components/shared/StatusBadge";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useAdminHeroSlides,
  useCreateHeroSlide,
  useDeleteHeroSlide,
  useReorderHeroSlides,
  useUpdateHeroSlide,
} from "@/hooks/usePlatform";
import { HeroSlideDialog } from "@/pages/admin/settings/components/hero-slide-dialog";
import {
  heroSlideToFormValues,
  toCreateHeroSlideCommand,
  toUpdateHeroSlideCommand,
  type HeroSlideFormValues,
} from "@/pages/admin/settings/components/hero-slide.schema";

const HERO = "admin.settings.storefront.hero";

type SlideStatus = "live" | "scheduled" | "ended" | "inactive";
const STATUS_TONE: Record<SlideStatus, BadgeTone> = {
  live: "success",
  scheduled: "warning",
  ended: "neutral",
  inactive: "neutral",
};

// Semantic statuses only — never the brand highlight (S37 §0.5: status badges keep their
// success / warning / neutral colors in the back-office).
function statusOf(slide: HeroSlideDto, today: string): SlideStatus {
  if (!slide.isActive) return "inactive";
  if (slide.isLive) return "live";
  if (slide.startsOn !== undefined && slide.startsOn > today) return "scheduled";
  return "ended";
}

// S38 — Settings → Storefront → Hero slider. Self-contained like DeliveryFeesSection: it owns its
// queries and mutations. Every mutation answers with the full ordered list (the hooks seed the
// cache from it), so the rows always show the true order after create, edit, delete and reorder.
export function HeroSlidesPanel() {
  const { t, language } = useTranslation();
  const slidesQuery = useAdminHeroSlides();
  const createSlide = useCreateHeroSlide();
  const updateSlide = useUpdateHeroSlide();
  const deleteSlide = useDeleteHeroSlide();
  const reorderSlides = useReorderHeroSlides();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlideDto | undefined>(undefined);
  const [deleting, setDeleting] = useState<HeroSlideDto | null>(null);

  const slides = slidesQuery.data ?? [];
  const today = storeLocalDate();
  const liveCount = slides.filter((s) => s.isLive).length;
  const limitReached = slides.length >= HERO_SLIDES_MAX;
  const locale = language === "en" ? ContentLocale.EN : ContentLocale.FR;
  const isMutating =
    createSlide.isPending ||
    updateSlide.isPending ||
    deleteSlide.isPending ||
    reorderSlides.isPending;

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (slide: HeroSlideDto) => {
    setEditing(slide);
    setDialogOpen(true);
  };

  const handleSubmit = (values: HeroSlideFormValues) => {
    const onSuccess = () => {
      toast.success(t(`${HERO}.saveSuccess`));
      setDialogOpen(false);
    };
    if (editing) {
      const command = toUpdateHeroSlideCommand(values, heroSlideToFormValues(editing));
      // Nothing changed: close without a pointless request.
      if (Object.keys(command).length === 0) {
        setDialogOpen(false);
        return;
      }
      updateSlide.mutate({ id: editing.id, command }, { onSuccess });
    } else {
      createSlide.mutate(toCreateHeroSlideCommand(values), { onSuccess });
    }
  };

  const move = (index: number, delta: -1 | 1) => {
    const ids = slides.map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorderSlides.mutate({ ids });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteSlide.mutate(deleting.id, {
      onSuccess: () => toast.success(t(`${HERO}.deleteSuccess`)),
      onSettled: () => setDeleting(null),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <SectionTitle as="h2" className="text-lg font-semibold">
            {t(`${HERO}.title`)}
          </SectionTitle>
          <CardDescription>{t(`${HERO}.description`)}</CardDescription>
        </div>
        <div className="space-y-1 sm:text-right">
          <Button onClick={openCreate} disabled={limitReached || isMutating}>
            <Plus className="mr-2 h-4 w-4" />
            {t(`${HERO}.add`)}
          </Button>
          {limitReached && (
            <p className="text-xs text-muted-foreground">{t(`${HERO}.limitReached`)}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {slidesQuery.isLoading ? (
          <TableSkeleton rows={3} columns={1} />
        ) : slidesQuery.isError ? (
          <NotFoundState
            title={t("admin.settings.saveError")}
            body={t("admin.settings.description")}
            action={
              <Button variant="outline" size="sm" onClick={() => slidesQuery.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : slides.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t(`${HERO}.empty`)}</p>
            {/* P7 — the professional-account slide is documented here, never seeded. */}
            <div className="rounded-md border border-dashed p-3 text-sm">
              <p className="font-medium">{t(`${HERO}.exampleTitle`)}</p>
              <p className="mt-1 text-muted-foreground">{t(`${HERO}.exampleBody`)}</p>
            </div>
          </div>
        ) : (
          <>
            {liveCount > HERO_SLIDES_PUBLIC_MAX && (
              <p className="flex items-start gap-1.5 text-sm text-warning-foreground">
                <AlertTriangle
                  className="mt-[0.15em] h-[1em] w-[1em] shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0">{t(`${HERO}.tooManyLive`, { count: liveCount })}</span>
              </p>
            )}
            <ul className="space-y-3">
              {slides.map((slide, index) => {
                const status = statusOf(slide, today);
                return (
                  <li
                    key={slide.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <img
                        src={slide.mobileImageUrl}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate font-medium">{slide.text[locale].title}</p>
                        <p className="truncate text-xs text-muted-foreground">{slide.link}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <StatusPill
                            tone={STATUS_TONE[status]}
                            label={t(`${HERO}.status.${status}`)}
                          />
                          {(slide.startsOn || slide.endsOn) && (
                            <span className="text-xs text-muted-foreground">
                              {slide.startsOn ?? "…"} → {slide.endsOn ?? "…"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t(`${HERO}.moveUp`)}
                        disabled={index === 0 || isMutating}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t(`${HERO}.moveDown`)}
                        disabled={index === slides.length - 1 || isMutating}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t(`${HERO}.edit`)}
                        disabled={isMutating}
                        onClick={() => openEdit(slide)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t(`${HERO}.delete`)}
                        disabled={isMutating}
                        onClick={() => setDeleting(slide)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>

      <HeroSlideDialog
        slide={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        isSaving={createSlide.isPending || updateSlide.isPending}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`${HERO}.deleteConfirm.title`)}</AlertDialogTitle>
            <AlertDialogDescription>{t(`${HERO}.deleteConfirm.body`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t(`${HERO}.delete`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
