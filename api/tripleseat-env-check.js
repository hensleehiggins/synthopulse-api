module.exports = async function handler(req, res) {
  const names = [
    "TRIPLESEAT_AUTH_URL",
    "TRIPLESEAT_TOKEN_URL",
    "TRIPLESEAT_API_BASE_URL",
    "TRIPLESEAT_REDIRECT_URI",
    "TRIPLESEAT_CLIENT_ID",
    "TRIPLESEAT_CLIENT_SECRET",
  ];

  const result = {};

  for (const name of names) {
    const value = process.env[name];

    result[name] = {
      present: Boolean(value),
      length: value ? value.length : 0,
      startsWith: value ? value.slice(0, 6) : null,
      endsWith: value ? value.slice(-4) : null,
    };
  }

  res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    result,
  });
};
