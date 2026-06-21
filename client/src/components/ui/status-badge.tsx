import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'ready' | 'migrated' | 'failed' | 'running' | 'completed' | 'cancelled';
  className?: string;
}

const statusConfig = {
  pending: {
    color: "bg-yellow-100 text-yellow-800",
    label: "Pending"
  },
  processing: {
    color: "bg-blue-100 text-blue-800",
    label: "Processing"
  },
  ready: {
    color: "bg-green-100 text-green-800",
    label: "Ready"
  },
  migrated: {
    color: "bg-purple-100 text-purple-800",
    label: "Migrated"
  },
  failed: {
    color: "bg-red-100 text-red-800",
    label: "Failed"
  },
  running: {
    color: "bg-blue-100 text-blue-800",
    label: "Running"
  },
  completed: {
    color: "bg-green-100 text-green-800",
    label: "Completed"
  },
  cancelled: {
    color: "bg-gray-100 text-gray-800",
    label: "Cancelled"
  }
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span 
      className={cn(
        "px-2 py-1 text-xs font-medium rounded-full",
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
