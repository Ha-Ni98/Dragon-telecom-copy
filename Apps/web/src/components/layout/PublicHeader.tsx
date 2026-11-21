import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, User as UserIcon, LogOut, ChevronsUpDown } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { StorefrontSearch } from "@/components/shared/StorefrontSearch";
import { CartCountBubble } from "@/components/shared/CartCountBubble";
import { StorefrontCategoryBar } from "@/components/layout/StorefrontCategoryBar";
import { STOREFRONT_HEADER_ID } from "@/config/constants";
import { Button } from "@/components/ui/button";
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
import { useClientMe, useCartCount } from "@/hooks/useClientPortal";
import { UserType } from "@dragon-telecom/contract";

export function PublicHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, displayName, logout } = useAuth();
  const cartCount = useCartCount();

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

  return (
    <header
      id={STOREFRONT_HEADER_ID}
      className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur-md"
    >
      {/* S37 — one search instance reflows via flex order: phones get logo + icons on row 1 and
          the search on its own full-width row 2; md+ gets logo | wide search | icons on one row.
          The cart lives in the bottom nav on phones (StorefrontBottomNav). */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:h-16 md:flex-nowrap md:gap-4 md:py-0">
        <Link
          to="/"
          className="order-1 flex min-w-0 shrink items-center"
          aria-label={t("header.home")}
        >
          <Logo size={32} textClassName="hidden min-[380px]:inline" />
        </Link>

        <div className="order-3 w-full basis-full md:order-2 md:mx-4 md:w-auto md:max-w-2xl md:flex-1 md:basis-auto">
          <StorefrontSearch />
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1 md:order-3 md:ml-0">
          <LanguageToggle />
          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="relative hidden md:inline-flex"
            aria-label={t("header.cartWithCount", { count: cartCount })}
          >
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              <CartCountBubble count={cartCount} />
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
            <>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="md:hidden"
                aria-label={t("auth.login.submit")}
              >
                <Link to="/login">
                  <UserIcon className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link to="/login">{t("auth.login.submit")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <StorefrontCategoryBar />
    </header>
  );
}
