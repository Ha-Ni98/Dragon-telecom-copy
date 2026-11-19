import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      // S37 — the ghost hover is the app's cyan --accent; the toggle is one of the admin/staff
      // places that carries the brand highlight instead (plan-S37 §0.5).
      className="hover:bg-highlight/10 hover:text-highlight focus-visible:ring-highlight"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label={t("common.actions.toggleTheme")}
    >
      {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}
