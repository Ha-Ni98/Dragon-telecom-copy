import { useTheme } from "next-themes";

// RC-5 — every chart used `hsl(var(--primary))`, but this project's design tokens are bare
// OKLCH channel triplets consumed everywhere else as `oklch(var(--x))` (index.css). `hsl(0.552
// 0.228 260.9)` is not a colour — the declaration was dropped and the element fell back to its
// initial value, which is why the charts read as blank in light mode. Values below are the
// literal OKLCH equivalents of index.css's :root and .dark tokens — keep them in step with that
// file if the palette ever changes. Literals rather than `var()` references, because Recharts
// writes these as SVG presentation attributes and browser support for `var()` there isn't
// something to bet a whole page on.
export interface ChartTheme {
  /** Categorical palette, in order. */
  series: string[];
  /** Axis tick labels. */
  axis: string;
  /** Cartesian grid lines. */
  grid: string;
  tooltipBg: string;
  tooltipFg: string;
  tooltipBorder: string;
}

const LIGHT: ChartTheme = {
  series: [
    "oklch(0.651 0.131 238.9)", // --primary
    "oklch(0.623 0.169 149.2)", // --success
    "oklch(0.786 0.16 85.3)", // --warning
    "oklch(0.636 0.208 25.4)", // --destructive
    "oklch(0.507 0.029 237.3)", // --muted-foreground
  ],
  axis: "oklch(0.507 0.029 237.3)", // --muted-foreground
  grid: "oklch(0.91 0.014 233.8)", // --border
  tooltipBg: "oklch(0.988 0.002 247.8)", // --card
  tooltipFg: "oklch(0.252 0.024 236)", // --foreground
  tooltipBorder: "oklch(0.91 0.014 233.8)", // --border
};

const DARK: ChartTheme = {
  series: [
    "oklch(0.891 0.028 229.2)", // --primary
    "oklch(0.735 0.201 149)", // --success
    "oklch(0.838 0.165 87.5)", // --warning
    "oklch(0.667 0.185 23.6)", // --destructive
    "oklch(0.797 0.037 218.7)", // --muted-foreground
  ],
  axis: "oklch(0.797 0.037 218.7)", // --muted-foreground
  grid: "oklch(0.461 0.07 207.2)", // --border
  tooltipBg: "oklch(0.369 0.059 208.4)", // --card
  tooltipFg: "oklch(0.961 0.012 223.5)", // --foreground
  tooltipBorder: "oklch(0.461 0.07 207.2)", // --border
};

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? DARK : LIGHT;
}
