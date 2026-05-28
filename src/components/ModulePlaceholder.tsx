import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ModulePlaceholderProps {
  title: string;
  description?: string;
  badge?: string;
}

export function ModulePlaceholder({ title, description, badge }: ModulePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </header>

      <Card className="border-dashed bg-muted/30">
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Construction className="size-7 text-primary" aria-hidden />
          </div>
          <h2 className="text-lg font-medium text-foreground">Próximamente</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Este módulo estará disponible en las próximas iteraciones del producto.
          </p>
        </div>
      </Card>
    </div>
  );
}
