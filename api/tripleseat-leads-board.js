function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bool(value) {
  if (typeof value === "boolean") return value;
  const t = text(value).toLowerCase();
  return t === "true" || t === "yes" || t === "1";
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(value) {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}

function easternDateKey(value) {
  const d = toDate(value);
  if (!d) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isFutureOrToday(value) {
  const eventKey = easternDateKey(value);
  const todayKey = easternDateKey(new Date());

  if (!eventKey || !todayKey) return false;
  return eventKey >= todayKey;
}

function daysUntil(value) {
  const d = toDate(value);
  if (!d) return null;

  const eventDate = new Date(d);
  eventDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysSince(value) {
  const d = toDate(value);
  if (!d) return null;

  const then = new Date(d);
  then.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((today.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateLabel(value, startTime = "") {
  const d = toDate(value);
  if (!d) return "Date pending";

  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return startTime ? `${datePart}, ${startTime}` : datePart;
}

function leadBlob(lead) {
  return [
    lead.id,
    lead.first_name,
    lead.last_name,
    lead.company,
    lead.event_description,
    lead.additional_information,
    lead.lead_source_name,
    lead.campaign_name,
    lead.campaign_source,
    lead.campaign_medium,
    Array.isArray(lead.lead_sources)
      ? lead.lead_sources.map((item) => item?.name || item?.lead_source_name || "").join(" ")
      : "",
  ]
    .map(text)
    .join(" ")
    .toLowerCase();
}

function isObviousTestLead(lead) {
  const blob = leadBlob(lead);

  return (
    blob.includes("test ") ||
    blob.includes(" test") ||
    blob.startsWith("test") ||
    blob.includes("webhook test") ||
    blob.includes("code test") ||
    blob.includes("kitchenpulse webhook")
  );
}

function isConverted(lead) {
  return Boolean(
    lead.converted_at ||
      lead.booking_id ||
      lead.event_id ||
      bool(lead.booking_lead)
  );
}

function isTurnedDown(lead) {
  return Boolean(lead.turned_down_at || text(lead.turned_down_reason));
}

function getLeadName(lead) {
  const first = text(lead.first_name);
  const last = text(lead.last_name);
  const company = text(lead.company);

  const person = [first, last].filter(Boolean).join(" ");
  return company || person || "Unnamed lead";
}

function getLeadSource(lead) {
  if (text(lead.lead_source_name)) return text(lead.lead_source_name);

  if (Array.isArray(lead.lead_sources) && lead.lead_sources.length > 0) {
    return lead.lead_sources
      .map((source) => source?.name || source?.lead_source_name || source?.lead_source_other || "")
      .filter(Boolean)
      .join(", ");
  }

  return text(lead.referral_source_other) || "Source pending";
}

function estimatedLeadValue(lead) {
  const guestCount = number(lead.guest_count);

  // Conservative placeholder until Tripleseat lead revenue/payment fields are wired.
  // Event leads should feel directional, not like a guaranteed booked invoice.
  if (guestCount >= 100) return guestCount * 95;
  if (guestCount >= 60) return guestCount * 90;
  if (guestCount >= 30) return guestCount * 80;
  if (guestCount >= 15) return guestCount * 70;

  return guestCount > 0 ? guestCount * 60 : 0;
}

function classifyLead(lead) {
  const guestCount = number(lead.guest_count);
  const eventDate = lead.event_date || null;
  const updatedAt = lead.updated_at || lead.created_at || null;

  const dUntil = daysUntil(eventDate);
  const dSinceUpdate = daysSince(updatedAt);

  const hasEventDate = Boolean(eventDate);
  const hasGuestCount = guestCount > 0;
  const hasUsefulContact = Boolean(text(lead.email_address) || text(lead.phone_number));
  const converted = isConverted(lead);
  const turnedDown = isTurnedDown(lead);

  if (turnedDown) {
    return {
      bucket: "closed",
      label: "Turned down",
      urgency: "closed",
      score: 0,
      reason: "Lead has been turned down.",
    };
  }

  if (converted) {
    return {
      bucket: "converted",
      label: "Converted",
      urgency: "converted",
      score: 0,
      reason: "Lead appears converted to a booking or event.",
    };
  }

  let score = 0;
  const reasons = [];

  if (guestCount >= 75) {
    score += 4;
    reasons.push("large guest count");
  } else if (guestCount >= 40) {
    score += 3;
    reasons.push("meaningful guest count");
  } else if (guestCount >= 20) {
    score += 2;
    reasons.push("moderate guest count");
  }

  if (dUntil !== null && dUntil >= 0 && dUntil <= 14) {
    score += 4;
    reasons.push("event date is close");
  } else if (dUntil !== null && dUntil >= 0 && dUntil <= 30) {
    score += 3;
    reasons.push("event date is within 30 days");
  } else if (dUntil !== null && dUntil >= 0 && dUntil <= 60) {
    score += 2;
    reasons.push("event date is within 60 days");
  }

  if (!hasEventDate) {
    score += 2;
    reasons.push("date missing");
  }

  if (!hasGuestCount) {
    score += 1;
    reasons.push("guest count missing");
  }

  if (!hasUsefulContact) {
    score += 1;
    reasons.push("contact detail missing");
  }

  if (dSinceUpdate !== null && dSinceUpdate >= 14) {
    score += 3;
    reasons.push("follow-up may be stale");
  } else if (dSinceUpdate !== null && dSinceUpdate >= 7) {
    score += 2;
    reasons.push("follow-up aging");
  }

  const blob = leadBlob(lead);
  if (
    blob.includes("birthday") ||
    blob.includes("corporate") ||
    blob.includes("rehearsal") ||
    blob.includes("wedding") ||
    blob.includes("shower") ||
    blob.includes("conference") ||
    blob.includes("private")
  ) {
    score += 1;
    reasons.push("event type likely valuable");
  }

  if (score >= 7) {
    return {
      bucket: "hot",
      label: "Hot lead",
      urgency: "high",
      score,
      reason: reasons.slice(0, 3).join(", ") || "High-priority lead.",
    };
  }

  if (score >= 4) {
    return {
      bucket: "followUp",
      label: "Follow-up watch",
      urgency: "medium",
      score,
      reason: reasons.slice(0, 3).join(", ") || "Worth follow-up.",
    };
  }

  return {
    bucket: "potential",
    label: "Potential demand",
    urgency: "normal",
    score,
    reason: reasons.slice(0, 3).join(", ") || "Open lead with future demand potential.",
  };
}

function mapLead(lead) {
  const classification = classifyLead(lead);
  const eventDate = lead.event_date || null;
  const guestCount = number(lead.guest_count);
  const estValue = estimatedLeadValue(lead);

  return {
    id: String(lead.id || ""),
    leadName: getLeadName(lead),
    company: text(lead.company),
    source: getLeadSource(lead),
    ownerName: [lead.owner?.first_name, lead.owner?.last_name].filter(Boolean).join(" ") || text(lead.owner?.email),
    eventDescription: text(lead.event_description || lead.additional_information),
    additionalInformation: text(lead.additional_information),
    guestCount,
    eventDate,
    eventDateIso: toIso(eventDate),
    dateLabel: formatDateLabel(eventDate, text(lead.start_time)),
    startTime: text(lead.start_time),
    endTime: text(lead.end_time),
    createdAt: toIso(lead.created_at),
    updatedAt: toIso(lead.updated_at),
    daysUntil: daysUntil(eventDate),
    daysSinceUpdate: daysSince(lead.updated_at || lead.created_at),
    estimatedValue: estValue,
    converted: isConverted(lead),
    turnedDown: isTurnedDown(lead),
    bookingLead: bool(lead.booking_lead),
    bookingId: lead.booking_id || null,
    eventId: lead.event_id || null,
    bucket: classification.bucket,
    label: classification.label,
    urgency: classification.urgency,
    score: classification.score,
    reason: classification.reason,
  };
}

function sortLeadPriority(a, b) {
  const bucketScore = {
    hot: 4,
    followUp: 3,
    potential: 2,
    converted: 1,
    closed: 0,
  };

  const aBucket = bucketScore[a.bucket] || 0;
  const bBucket = bucketScore[b.bucket] || 0;

  if (aBucket !== bBucket) return bBucket - aBucket;
  if ((a.score || 0) !== (b.score || 0)) return (b.score || 0) - (a.score || 0);

  const aDays = typeof a.daysUntil === "number" ? a.daysUntil : Number.MAX_SAFE_INTEGER;
  const bDays = typeof b.daysUntil === "number" ? b.daysUntil : Number.MAX_SAFE_INTEGER;

  if (aDays !== bDays) return aDays - bDays;

  return (b.estimatedValue || 0) - (a.estimatedValue || 0);
}

function sumValue(rows) {
  return rows.reduce((sum, row) => sum + (number(row.estimatedValue) || 0), 0);
}

async function getTripleseatAccessToken() {
  const tokenUrl = requireEnv("TRIPLESEAT_TOKEN_URL");
  const clientId = requireEnv("TRIPLESEAT_CLIENT_ID");
  const clientSecret = requireEnv("TRIPLESEAT_CLIENT_SECRET");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  });

  const raw = await response.text();

  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (!response.ok || !json?.access_token) {
    throw new Error(
      json?.error_description ||
        json?.error ||
        `Failed to get Tripleseat access token. Status ${response.status}. Preview: ${raw.slice(0, 400)}`
    );
  }

  return json.access_token;
}

async function fetchTripleseatLeads() {
  const accessToken = await getTripleseatAccessToken();
  const apiBaseUrl = requireEnv("TRIPLESEAT_API_BASE_URL").replace(/\/$/, "");
  const locationId = process.env.TRIPLESEAT_LOCATION_ID || "34084";

  const allLeads = [];
  const testedUrls = [];

  let page = 1;
  let totalPages = 1;

  // Tripleseat paginates leads. Pull every available page so the pipeline
  // is not falsely empty just because page 1 is mostly converted/closed.
  while (page <= totalPages && page <= 10) {
    const url = new URL(`${apiBaseUrl}/leads`);
    url.searchParams.set("location_id", locationId);
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "User-Agent": "KitchenPulse/1.0",
      },
    });

    const raw = await response.text();

    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }

    if (!response.ok || !json) {
      throw new Error(
        `Failed to fetch Tripleseat leads page ${page}. Status ${response.status}. Preview: ${raw.slice(
          0,
          400
        )}`
      );
    }

    testedUrls.push(url.toString());

    const rawLeads = Array.isArray(json.results)
      ? json.results
      : Array.isArray(json.leads)
        ? json.leads
        : Array.isArray(json)
          ? json
          : [];

    allLeads.push(...rawLeads);

    totalPages = Number(json.total_pages || json.totalPages || totalPages || 1);

    page += 1;
  }

  const deduped = Array.from(
    new Map(allLeads.map((lead) => [String(lead.id || Math.random()), lead])).values()
  );

  return {
    url: testedUrls[0] || `${apiBaseUrl}/leads?location_id=${locationId}`,
    testedUrls,
    totalPages,
    rawCount: deduped.length,
    rawLeads: deduped,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const fetched = await fetchTripleseatLeads();

    const allMapped = fetched.rawLeads
      .filter((lead) => !isObviousTestLead(lead))
      .map(mapLead);

    const activeOpenLeads = allMapped
      .filter((lead) => !lead.converted)
      .filter((lead) => !lead.turnedDown)
      .filter((lead) => {
        if (!lead.eventDate) return true;
        return isFutureOrToday(lead.eventDate);
      })
      .sort(sortLeadPriority);

            const hotLeads = activeOpenLeads
      .filter((lead) => lead.bucket === "hot")
      .sort(sortLeadPriority)
      .slice(0, 3);

    const followUpWatch = activeOpenLeads
      .filter((lead) => lead.bucket === "followUp")
      .sort(sortLeadPriority)
      .slice(0, 3);

    // Potential Demand is intentionally broad.
    // It answers: "What open leads could become future room/staffing/prep demand?"
    // So it can overlap with Hot Leads / Follow-Up Watch.
    const potentialDemand = activeOpenLeads
      .sort(sortLeadPriority)
      .slice(0, 3);

    const convertedLeads = allMapped.filter((lead) => lead.converted);
    const closedLeads = allMapped.filter((lead) => lead.turnedDown);

    const openValue = sumValue(activeOpenLeads);
    const hotValue = sumValue(activeOpenLeads.filter((lead) => lead.bucket === "hot"));
    const followUpValue = sumValue(activeOpenLeads.filter((lead) => lead.bucket === "followUp"));

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      sourceUrl: fetched.url,
      rawFetchedCount: fetched.rawCount,
      activeOpenCount: activeOpenLeads.length,
      stats: {
        openLeads: activeOpenLeads.length,
        hotLeads: activeOpenLeads.filter((lead) => lead.bucket === "hot").length,
        followUpWatch: activeOpenLeads.filter((lead) => lead.bucket === "followUp").length,
        potentialDemand: activeOpenLeads.length,
        convertedLeads: convertedLeads.length,
        closedLeads: closedLeads.length,
        openValue,
        hotValue,
        followUpValue,
      },
      hotLeads,
      followUpWatch,
      potentialDemand,
      sample: activeOpenLeads.slice(0, 5),
    });
  } catch (error) {
    console.error("tripleseat-leads-board error", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "Tripleseat leads board failed",
    });
  }
};
