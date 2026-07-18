import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };

function SkeletonCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { SkeletonCard };

export default function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Table Header Skeleton */}
      <div className="bg-gray-50 border-b border-gray-200 py-4 px-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-300"></div>
          <div className="h-4 w-32 animate-pulse rounded bg-gray-300"></div>
          <div className="h-4 w-28 animate-pulse rounded bg-gray-300"></div>
          <div className="h-4 w-20 animate-pulse rounded bg-gray-300"></div>
        </div>
      </div>

      {/* Table Body Skeleton */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="py-5 px-6 animate-pulse">
            <div className="grid grid-cols-4 gap-4 items-center">
              {/* Status Dot + Text */}
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-gray-200"></div>
                <div className="h-4 w-20 rounded bg-gray-200"></div>
              </div>
              {/* Name/Info */}
              <div className="h-4 w-40 rounded bg-gray-200"></div>
              {/* Details */}
              <div className="h-4 w-32 rounded bg-gray-200"></div>
              {/* Action Button */}
              <div className="h-8 w-24 rounded-md bg-gray-100 border border-gray-200"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
