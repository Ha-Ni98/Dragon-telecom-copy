import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

// Static public landing page — the template's example of a PublicLayout page. Replace with
// your app's real marketing/entry content.
export default function LandingPage() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
      <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <Rocket className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        {t("public.landing.title")}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
        {t("public.landing.subtitle")}
      </p>
      <div className="mt-8">
        <Button asChild size="lg">
          <Link to="/login">{t("public.landing.cta")}</Link>
        </Button>
      </div>
    </section>
  );
}
