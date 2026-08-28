import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTextSetting, useSelectSetting, useNavigationSetting, useImageSetting } from "@/lib/editable-settings";
import { NavigationAction } from "@/components/navigation-action";

export default function Block() {
  const headline = useTextSetting({
    name: "headline",
    label: "Headline",
    initialValue: "Review Fried Lobster Tail before next rush",
  });

  const supportingLine = useTextSetting({
    name: "supporting-line",
    label: "Supporting line",
    initialValue: "Margin risk is forming — early correction prevents bleed",
  });

  const timing = useTextSetting({
    name: "timing",
    label: "Timing",
    initialValue: "Act before next rush",
  });

  const priorityLabel = useTextSetting({
    name: "priority-label",
    label: "Priority label",
    initialValue: "Medium priority",
  });

  const forwardSignal = useTextSetting({
    name: "forward-signal",
    label: "Forward signal",
    initialValue: "Watch next run",
  });

  const doNow = useTextSetting({
    name: "do-now",
    label: "Do now",
    initialValue: "Adjust pricing or portion size by end of shift",
  });

  const why = useTextSetting({
    name: "why",
    label: "Why",
    initialValue: "Food cost spiked 8% this week, eroding profit margin",
  });

  const ifIgnored = useTextSetting({
    name: "if-ignored",
    label: "If ignored",
    initialValue: "Could lose $400+ in margin by week's end",
  });

  const ctaText = useTextSetting({
    name: "cta-text",
    label: "CTA Text",
    initialValue: "Review Brief →",
  });

  const ctaLink = useNavigationSetting({
    name: "cta-link",
    label: "CTA Link",
    initialValue: {
      destination: "/",
      openIn: "TAB",
    },
  });

  const priorityLevel = useSelectSetting({
    name: "priority-level",
    label: "Priority level",
    options: ["high", "medium", "low"],
    optionsMeta: {
      high: { label: "High (Red)" },
      medium: { label: "Medium (Yellow)" },
      low: { label: "Low (Green)" },
    },
    initialValue: "high",
  });

  const backgroundImage = useImageSetting({
    name: "background-image",
    label: "Background image",
    initialValue: {
      src: "https://replicate.delivery/xezq/zJO9U52wAezDW6PTjkX9AMOhkSpx0WAzOPxeHgFNpDfeex6zC/out-0.webp",
      alt: "Decision card background",
    },
  });

  const accentColors = {
    high: "border-red-500",
    medium: "border-yellow-500",
    low: "border-green-500",
  };

  const priorityTextColors = {
    high: "text-red-600",
    medium: "text-yellow-600",
    low: "text-green-600",
  };

  return (
    <div className="container py-6">
      <div className="content max-w-[1000px] mx-auto">
        <Card 
          className={`relative overflow-hidden border-l-4 ${accentColors[priorityLevel]} shadow-lg`}
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98)), url(${backgroundImage.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="p-8 md:p-10 space-y-6">
            {/* Headline */}
            <div className="space-y-3">
              <h2 className="font-heading text-2xl md:text-3xl text-foreground leading-tight">
                {headline}
              </h2>
              <p className="text-base text-muted-foreground font-medium">
                {supportingLine}
              </p>
              
              {/* Urgency strip - visible inline row */}
              <div className="flex items-center gap-3 text-sm font-semibold text-foreground/90 pt-2">
                <span>{timing}</span>
                <span className="text-muted-foreground/60">•</span>
                <span className={priorityTextColors[priorityLevel]}>{priorityLabel}</span>
                <span className="text-muted-foreground/60">•</span>
                <span>{forwardSignal}</span>
              </div>
            </div>

            {/* Inline structure */}
            <div className="space-y-3 py-4 border-y border-border/50">
              <div className="flex gap-3 items-start">
                <span className="font-semibold text-sm text-foreground min-w-[90px]">Do now:</span>
                <span className="text-sm text-foreground flex-1">{doNow}</span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="font-semibold text-sm text-foreground min-w-[90px]">Why:</span>
                <span className="text-sm text-muted-foreground flex-1">{why}</span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="font-semibold text-sm text-foreground min-w-[90px]">If ignored:</span>
                <span className="text-sm text-destructive flex-1">{ifIgnored}</span>
              </div>
            </div>

            {/* Primary action */}
            <div className="pt-2">
              <Button size="lg" className="w-full md:w-auto px-8" asChild>
                <NavigationAction navigation={ctaLink}>
                  {ctaText}
                </NavigationAction>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
