import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { WorkspaceFocusProvider } from "@/components/providers/WorkspaceFocusProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <WorkspaceFocusProvider>
            <AuthProvider>
              <App />
              <Toaster
                richColors
                position="bottom-right"
                // S37 — clear the storefront bottom nav on phones; --bottom-nav-offset is 0
                // everywhere else (index.css), so admin/staff toasts sit exactly where they did.
                // Only `bottom` is set: Sonner fills unset keys with its own 24px/16px defaults.
                offset={{ bottom: "calc(var(--bottom-nav-offset) + 24px)" }}
                mobileOffset={{ bottom: "calc(var(--bottom-nav-offset) + 16px)" }}
              />
            </AuthProvider>
          </WorkspaceFocusProvider>
        </LanguageProvider>
      </ThemeProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);
