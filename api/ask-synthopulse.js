export default async function handler(req, res) {
  try {
    const { message } = req.body;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.3",
        input: `You are SynthoPulse, an AI assistant for restaurant operators.

Give clear, actionable recommendations based on this input:
${message}`
      })
    });

    const data = await response.json();

    res.status(200).json({
      reply: data.output[0].content[0].text
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
