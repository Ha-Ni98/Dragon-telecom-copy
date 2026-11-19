import { SectionTitle } from "@/components/shared/SectionTitle";

interface Props {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: Props) {
  return (
    <div>
      <SectionTitle
        as="h1"
        className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
      >
        {title}
      </SectionTitle>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
