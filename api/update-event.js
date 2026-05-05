export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    route: "update-event",
    method: req.method,
    time: new Date().toISOString()
  });
}
