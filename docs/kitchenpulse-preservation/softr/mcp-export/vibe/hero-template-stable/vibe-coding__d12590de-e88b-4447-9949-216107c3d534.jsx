import { useRecord, useCurrentRecordId, q } from "@/lib/datasource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Circle } from "lucide-react";
import { useState } from "react";

const select = q.select({
  name: "Name",
  heroState: "Hero State",
  heroConfidence: "Hero Confidence",
  heroTimeContext: "Hero Time Context",
  heroHeadline: "Hero Headline",
  heroSubheadline: "Hero Subheadline",
  heroPill1: "Hero Pill 1",
  heroPill2: "Hero Pill 2",
  heroPill3: "Hero Pill 3",
  heroCardLabel: "Hero Card Label",
  heroCardValue: "Hero Card Value",
  heroCardPriority: "Hero Card Priority",
  quickWhy: "Quick - Why",
  quickFirstAction: "Quick - First Action",
  quickIgnoreRisk: "Quick - Ignore Risk",
  quickWatch: "Quick - Watch",
  whyFull: "Why Full",
  summary: "Summary",
});

export default function Block() {
  const recordId = useCurrentRecordId();
  const { data, status } = useRecord({
    recordId,
    select,
  });
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  if (status === "pending") return <div className="container py-6"><div className="content">Loading...</div></div>;
  if (status === "error" || !data) return <div className="container py-6"><div className="content">Error loading data</div></div>;

  const heroState = data.fields.heroState?.label || "";
  const heroConfidence = data.fields.heroConfidence || "";

  const getBorderColor = () => {
    switch(heroState) {
      case 'PUSH': return '#3b82f6';
      case 'PROTECT': return '#06b6d4';
      case 'RECOVER': return '#14b8a6';
      case 'WATCH': return '#10b981';
      default: return '#9ca3af';
    }
  };

  const getConfidenceColor = () => {
    const conf = heroConfidence.toLowerCase();
    if (conf.includes('high')) return 'text-green-600';
    if (conf.includes('medium')) return 'text-yellow-600';
    if (conf.includes('low')) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="w-full">
      {/* Single Shared Container for Both Sections */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Premium Integrated Header */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-extrabold tracking-wider uppercase text-foreground">Today's Decision</h2>
            {data.fields.heroTimeContext && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                <Circle className="h-1.5 w-1.5 fill-current text-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-700">{data.fields.heroTimeContext}</span>
              </div>
            )}
          </div>
          <div className="border-t border-border" />
        </div>

        {/* Primary Decision Card */}
        <Card className="border-l-4 shadow-md bg-card" style={{ borderLeftColor: getBorderColor() }}>
          <CardHeader className="space-y-4 pb-4">
            {/* Header Row: Action Tag + Confidence */}
            <div className="flex items-start justify-between gap-4">
              <div>
                {heroState && (
                  <Badge variant="outline" className="font-semibold" style={{ borderColor: getBorderColor(), color: getBorderColor() }}>
                    {heroState}
                  </Badge>
                )}
              </div>
              {heroConfidence && (
                <div className="flex items-center gap-2">
                  <Circle className={`h-2 w-2 fill-current ${getConfidenceColor()}`} />
                  <span className={`text-sm font-medium ${getConfidenceColor()}`}>{heroConfidence}</span>
                </div>
              )}
            </div>

            {/* Title */}
            {data.fields.heroHeadline && (
              <CardTitle className="text-2xl leading-tight">{data.fields.heroHeadline}</CardTitle>
            )}

            {/* Supporting Summary */}
            {data.fields.heroSubheadline && (
              <p className="text-muted-foreground leading-relaxed">{data.fields.heroSubheadline}</p>
            )}

            {/* Signal Pills */}
            <div className="flex flex-wrap gap-2">
              {data.fields.heroPill1 && <Badge variant="secondary" className="font-medium">{data.fields.heroPill1}</Badge>}
              {data.fields.heroPill2 && <Badge variant="secondary" className="font-medium">{data.fields.heroPill2}</Badge>}
              {data.fields.heroPill3 && <Badge variant="secondary" className="font-medium">{data.fields.heroPill3}</Badge>}
            </div>

            {/* Inline Operator Block */}
            <div className="space-y-3 pt-2 border-t">
              {data.fields.quickFirstAction && (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">Do now:</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{formatText(data.fields.quickFirstAction)}</div>
                </div>
              )}
              {data.fields.quickWhy && (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">Why:</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{formatText(data.fields.quickWhy)}</div>
                </div>
              )}
              {data.fields.quickIgnoreRisk && (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-red-600">If ignored:</div>
                  <div className="text-sm text-red-600/80 leading-relaxed">{formatText(data.fields.quickIgnoreRisk)}</div>
                </div>
              )}
            </div>

            {/* Priority Item */}
            {(data.fields.heroCardLabel || data.fields.heroCardValue) && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    {data.fields.heroCardLabel && (
                      <div className="text-sm text-muted-foreground">{data.fields.heroCardLabel}</div>
                    )}
                    {data.fields.heroCardValue && (
                      <div className="text-lg font-semibold">{data.fields.heroCardValue}</div>
                    )}
                  </div>
                  {data.fields.heroCardPriority && (
                    <div className="flex items-center gap-2">
                      <Circle className="h-2 w-2 fill-current text-orange-500" />
                      <span className="text-sm font-medium text-muted-foreground">{data.fields.heroCardPriority}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardHeader>
          </Card>

          {/* Operational Context */}
        <div className="flex flex-wrap gap-2 text-xs mt-4">
          {data.fields.heroPill1 && (
            <Badge variant="outline" className="font-normal">
              Service: {data.fields.heroPill1}
            </Badge>
          )}
          {data.fields.heroPill2 && (
            <Badge variant="outline" className="font-normal">
              Pressure: {data.fields.heroPill2}
            </Badge>
          )}
          {data.fields.heroPill3 && (
            <Badge variant="outline" className="font-normal">
              {data.fields.heroPill3}
            </Badge>
          )}
        </div>

          {/* Why This Surfaced - Collapsible */}
          <div className="mt-4">
        {(data.fields.whyFull || data.fields.summary) && (
          <Collapsible open={isWhyOpen} onOpenChange={setIsWhyOpen}>
            <Card className="border">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-lg">Why this surfaced</CardTitle>
                  <ChevronDown className={`h-5 w-5 transition-transform ${isWhyOpen ? 'rotate-180' : ''}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 text-muted-foreground leading-relaxed [&_.why-rich-text_p]:mb-3 [&_.why-rich-text_strong]:font-semibold [&_.why-rich-text_strong]:text-foreground [&_.why-rich-text_em]:text-muted-foreground [&_.why-rich-text_em]:italic">
  {data.fields.whyFull && (
    <div
      className="why-rich-text"
      dangerouslySetInnerHTML={{ __html: data.fields.whyFull }}
    />
  )}
  {data.fields.summary && (
    <div className="space-y-3 pt-3 border-t">{formatText(data.fields.summary)}</div>
  )}
</CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
          </div>


      </div>
    </div>
  );
}
