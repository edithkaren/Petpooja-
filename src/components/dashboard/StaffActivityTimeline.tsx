/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { StaffActivity } from "@/types";
import { format } from "date-fns";
import { 
  LogIn, 
  LogOut, 
  FileText, 
  AlertCircle, 
  MapPin, 
  Circle,
  Clock,
  Flame,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffActivityTimelineProps {
  activities: StaffActivity[];
  className?: string;
}

export const StaffActivityTimeline: React.FC<StaffActivityTimelineProps> = ({ 
  activities,
  className 
}) => {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Clock className="w-12 h-12 mb-4 opacity-20" />
        <p>No recent activity found</p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'Login': return <LogIn className="w-4 h-4 text-emerald-500" />;
      case 'Logout': return <LogOut className="w-4 h-4 text-slate-400" />;
      case 'BillGenerated': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'OrderCancelled': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'TableAssigned': return <MapPin className="w-4 h-4 text-orange-500" />;
      case 'KOTPrepared': return <Flame className="w-4 h-4 text-amber-600" />;
      case 'PrepCompleted': return <CheckCircle2 className="w-4 h-4 text-teal-600" />;
      default: return <Circle className="w-4 h-4 text-slate-300" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'Login': return "bg-emerald-50";
      case 'Logout': return "bg-slate-50";
      case 'BillGenerated': return "bg-blue-50";
      case 'OrderCancelled': return "bg-rose-50";
      case 'TableAssigned': return "bg-orange-50";
      case 'KOTPrepared': return "bg-amber-50";
      case 'PrepCompleted': return "bg-teal-50";
      default: return "bg-slate-50";
    }
  };

  return (
    <div className={cn("relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent", className)}>
      {activities.map((activity) => (
        <div key={activity.id} className="relative flex items-start gap-6 group">
          {/* Dot/Icon container */}
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full shrink-0 z-10 transition-transform group-hover:scale-110",
            getBgColor(activity.type)
          )}>
            {getIcon(activity.type)}
          </div>

          {/* Content */}
          <div className="flex-1 pt-1.5 pb-6 border-b border-slate-100 last:border-0">
            <div className="flex items-center justify-between gap-4 mb-1">
              <h4 className="text-sm font-semibold text-slate-900">{activity.description}</h4>
              <time className="text-xs font-medium text-slate-400 whitespace-nowrap">
                {format(new Date(activity.timestamp), 'MMM d, HH:mm')}
              </time>
            </div>
            {activity.metadata && (
              <div className="mt-2 flex flex-wrap gap-2">
                {activity.metadata.amount && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                    ₹{activity.metadata.amount}
                  </span>
                )}
                {activity.metadata.billId && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                    #{activity.metadata.billId.slice(-6)}
                  </span>
                )}
                {activity.metadata.station && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
                    {activity.metadata.station}
                  </span>
                )}
                {activity.metadata.reason && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700">
                    Reason: {activity.metadata.reason}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
