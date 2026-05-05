fetch("https://project-1csz2.vercel.app/api/update-event", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    recordId: item.id,
    eventName,
    startDateTime,
    endDateTime,
    estimatedDraw,
    trafficEffect,
    venueArea,
  }),
});
