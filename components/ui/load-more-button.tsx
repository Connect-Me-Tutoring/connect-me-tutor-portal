import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadMoreButtonProps {
  hasMore: boolean;
  onClick: () => void;
  className?: string;
}

/** Mobile pagination footer: a centered "Load More" button, or nothing once everything is shown. */
export function LoadMoreButton({ hasMore, onClick, className }: LoadMoreButtonProps) {
  if (!hasMore) return null;

  return (
    <div className={cn("flex justify-center pt-2", className)}>
      <Button variant="outline" onClick={onClick}>
        Load More
      </Button>
    </div>
  );
}
