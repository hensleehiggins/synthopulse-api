
import { useMemo } from "react";
import { useTextSetting, useImageSetting } from "@/lib/editable-settings";
import { useCurrentUser } from "@/lib/user";

export default function Block() {
  const user = useCurrentUser();
  const morningGreeting = useTextSetting({
    name: "morning-greeting",
    label: "Morning greeting",
    initialValue: "Rise and shine, {user_softr_user_first_name|friend}",
  });
  const morningSubtitle = useTextSetting({
    name: "morning-subtitle",
    label: "Morning subtitle",
    initialValue: "Fresh day ahead — let's make it count",
  });

  const afternoonGreeting = useTextSetting({
    name: "afternoon-greeting",
    label: "Afternoon greeting",
    initialValue: "Good afternoon, {user_softr_user_first_name|friend}",
  });
  const afternoonSubtitle = useTextSetting({
    name: "afternoon-subtitle",
    label: "Afternoon subtitle",
    initialValue: "Keep the momentum going",
  });

  const eveningGreeting = useTextSetting({
    name: "evening-greeting",
    label: "Evening greeting",
    initialValue: "Good evening, {user_softr_user_first_name|friend}",
  });
  const eveningSubtitle = useTextSetting({
    name: "evening-subtitle",
    label: "Evening subtitle",
    initialValue: "Wrapping things up for the day?",
  });
  const fallbackAvatar = useImageSetting({
    name: "fallback-avatar",
    label: "Fallback avatar",
    initialValue: { src: "https://assets.softr-files.com/assets/blocks/v5/mock-images/avatar/avatar-08.jpg" },
  });

  const { greeting, subtitle } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { greeting: morningGreeting, subtitle: morningSubtitle };
    if (hour < 18) return { greeting: afternoonGreeting, subtitle: afternoonSubtitle };
    return { greeting: eveningGreeting, subtitle: eveningSubtitle };
  }, [morningGreeting, morningSubtitle, afternoonGreeting, afternoonSubtitle, eveningGreeting, eveningSubtitle]);

  return (
    <div className="container relative py-6">
      <div className="content">
        <div className="flex items-start md:items-center gap-5">
          {/* Left: Avatar */}
          <div className="animate-in fade-in zoom-in-95 animation-duration-300 ease-out fill-mode-backwards flex-shrink-0">
            <img
              src={user?.avatar ?? fallbackAvatar.src}
              alt="User avatar"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover border-2 border-primary/10 bg-muted"
            />
          </div>

          {/* Right: Content */}
          <div className="flex-1 min-w-0">
            {greeting && (
              <h2 className="animate-in fade-in slide-in-from-bottom-1 animation-duration-300 delay-75 ease-out fill-mode-backwards text-2xl text-foreground mb-1 leading-tight tracking-tight font-heading">
                {greeting}
              </h2>
            )}
            {subtitle && (
              <p className="animate-in fade-in slide-in-from-bottom-1 animation-duration-300 delay-100 ease-out fill-mode-backwards text-base text-muted-foreground max-w-xl leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

