import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingCart, User as UserIcon, LogOut, ChevronsUpDown } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { StorefrontSearch } from "@/components/shared/StorefrontSearch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTranslation } from "@/hooks/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useClientMe } from "@/hooks/useClientPortal";
import { UserType } from "@dragon-telecom/contract";

function scrollToFooter() {
  document.querySelector("footer")?.scrollIntoView({ behavior: "smooth" });
}

export function PublicHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, displayName, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // S15/F1 — Session.profile is null for every CLIENT (types/session.ts), so AuthProvider's
  // displayName is always null on the storefront for a client and the avatar rendered an empty
  // circle. The client's own profile (clients module) is the only source of a display name here.
  const { data: session } = useSession();
  const { data: clientMe } = useClientMe({ enabled: session?.type === UserType.CLIENT });
  const accountName =
    displayName ?? (clientMe ? `${clientMe.firstName} ${clientMe.lastName}` : null);
  const initials = accountName
    ? accountName
        .split(" ")
        .filter(Boolean)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navLinks = (onNavigate?: () => void) => (
    <>
      <Link
        to="/"
        onClick={onNavigate}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        {t("header.home")}
      </Link>
      <Link
        to="/products"
        onClick={onNavigate}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        {t("header.products")}
      </Link>
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          scrollToFooter();
        }}
        className="text-start text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        {t("header.contact")}
      </button>
    </>
  );

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("header.menu")}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-16 items-center border-b border-border px-4">
              <Logo size={32} />
            </div>
            <nav className="flex flex-col gap-4 p-4">{navLinks(() => setMobileOpen(false))}</nav>
          </SheetContent>
        </Sheet>

        {/* S15 — mobile search replaces the logo in place (no room for both at phone width);
            the logo/nav stay put on md+ regardless of mobileSearchOpen. */}
        <Link
          to="/"
          className={mobileSearchOpen ? "hidden items-center md:flex" : "flex items-center"}
        >
          <Logo size={36} />
        </Link>

        {mobileSearchOpen && (
          <div className="flex flex-1 md:hidden">
            <StorefrontSearch
              variant="mobile"
              autoFocus
              onDone={() => setMobileSearchOpen(false)}
            />
          </div>
        )}

        <nav className="hidden items-center gap-6 md:flex">{navLinks()}</nav>

        <div className="hidden flex-1 max-w-sm md:flex">
          <StorefrontSearch variant="desktop" />
        </div>

        <div
          className={
            mobileSearchOpen
              ? "ml-auto hidden items-center gap-1 md:flex"
              : "ml-auto flex items-center gap-1"
          }
        >
          {!mobileSearchOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={t("header.openSearch")}
              onClick={() => setMobileSearchOpen(true)}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
          <LanguageToggle />
          <ThemeToggle />

          <Button variant="ghost" size="icon" asChild aria-label={t("accessibility.cart")}>
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="ml-1 gap-2 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {initials ?? <UserIcon className="h-4 w-4" />}
                  </div>
                  <ChevronsUpDown className="hidden h-3 w-3 text-muted-foreground sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{accountName ?? t("header.account")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-account">
                    <UserIcon className="mr-2 h-4 w-4" /> {t("header.account")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders">
                    <ShoppingCart className="mr-2 h-4 w-4" /> {t("header.myOrders")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" /> {t("common.actions.signOut")}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("header.signOutConfirm.title")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("header.signOutConfirm.body")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLogout}>
                        {t("common.actions.signOut")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">{t("auth.login.submit")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
