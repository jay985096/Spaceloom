export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  // 你的店铺域名已填好
  const shopifyDomain = "https://spaceloom.myshopify.com";
  const headers = {
    "Access-Control-Allow-Origin": shopifyDomain,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return Response.json({ error: "Only POST allowed" }, { status: 400, headers });

  const { userPrompt } = await req.json();
  const accessKeyId = process.env.VOLC_ACCESS_KEY_ID;
  const secretKey = process.env.VOLC_SECRET_KEY;
  const epId = process.env.ARK_ENDPOINT_ID;

  const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const auth = btoa(`${accessKeyId}:${secretKey}`);

  const systemPrompt = `
You are a professional North American furniture matching consultant.
Users will input room size, interior style, budget, room type.
Recommend matched furniture.
Remind users to click links to view products on Wayfair.
All reply use English, output clean and easy to read.
`;

  const body = JSON.stringify({
    model: epId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7
  });

  try {
    const res = await fetch(arkUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body
    });
    const data = await res.json();
    if (!data.choices) throw new Error(data.error?.message || "API response empty");
    return Response.json({ reply: data.choices[0].message.content }, { headers });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers });
  }
}
