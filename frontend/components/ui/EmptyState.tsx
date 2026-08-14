import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyState({ icon: Icon, title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <Card className="my-6 border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </div>
        <div className="flex max-w-md flex-col gap-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Button render={<Link href={actionHref} />}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
