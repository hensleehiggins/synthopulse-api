import { useRecords, q } from "@/lib/datasource";
import { useCurrentUser } from "@/lib/user";
import { useTextSetting } from "@/lib/editable-settings";
import { format } from "date-fns";

const select = q.select({
  eventName: "Event Name",
  description: "Description",
  estimatedDraw: "Estimated Draw",
  startDateTime: "Start DateTime",
  impactStrength: "Impact Strength",
  type: "Type",
  active: "Active",
  forecastDate: "Forecast Date",
  restaurant: "Restaurant",
});

export default function Block() {
  const user = useCurrentUser({
    properties: {
      restaurantId: "z0b2k",
    },
  });

  const labelText = useTextSetting({
    name: "label-text",
    label: "Label Text",
    initialValue: "LOCAL EVENT TONIGHT",
  });

  const sublineText = useTextSetting({
    name: "subline-text",
    label: "Subline Text",
    initialValue: "High impact • Nearby • Expect irregular traffic patterns",
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const { data, status } = useRecords({
    select,
    where: q.and(
      q.text("type").is("Event"),
      q.boolean("active").is(true),
      q.date("forecastDate").is(todayStr)
    ),
    orderBy: q.desc("impactStrength"),
    count: 1,
  });

  if (status === "pending") {
    return (
      <div className="container py-3">
        <div className="content">
          <div className="rounded-lg border-l-4 border-amber-500/30 bg-amber-50/30 px-4 py-3">
            <div className="text-sm text-muted-foreground">Loading event data...</div>
          </div>
        </div>
      </div>
    );
  }

  const items = data?.pages.flatMap((page) => page.items) || [];
  const event = items[0];

  if (!event) {
    return null;
  }

  const eventName = event.fields.eventName || event.fields.description || "Local Event";
  const eventTitle = `${eventName} tonight`;
  const startTime = event.fields.startDateTime
    ? format(new Date(event.fields.startDateTime), "h:mm a")
    : null;

  return (
    <div className="container py-3">
      <div className="content">
        <div className="rounded-lg border-l-4 border-amber-500/50 bg-amber-50/40 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labelText}
            </div>
            <div className="text-base font-semibold text-foreground">
              {eventTitle}
            </div>
            <div className="text-sm text-muted-foreground">
              {sublineText}
              {startTime && ` • Starts at ${startTime}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
