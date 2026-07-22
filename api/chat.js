export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  // 固定跨域头部，所有响应全部携带，不会丢失
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://spaceloom.myshopify.com",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // 单独处理浏览器OPTIONS预检请求（解决核心拦截根源）
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Only POST requests allowed" }, { status: 405, headers: corsHeaders });
  }

  const arkApiKey = process.env.ARK_API_KEY;
  if (!arkApiKey) {
    return Response.json({ error: "Missing ARK_API_KEY environment variable" }, { status: 500, headers: corsHeaders });
  }

  let userPrompt;
  try {
    const body = await req.json();
    userPrompt = body.userPrompt;
  } catch (parseErr) {
    return Response.json({ error: "Failed to parse input content" }, { status: 400, headers: corsHeaders });
  }

  const endpointId = "ep-20260722205932-hwkh5";
  const arkApiUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  try {
    const arkResponse = await fetch(arkApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${arkApiKey}`,
        "Content-Type": "application/json",
        "X-Volc-ARK-Endpoint-Id": endpointId
      },
      body: JSON.stringify({
        model: endpointId,
        messages: [
          {
            role: "system",
            content: "You are a professional North American indoor furniture matching designer. All output must be English. Recommend furniture matching plans according to customer budget, house type, room size, style preference and functional demands, and finally guide customers to buy matching furniture on Wayfair."
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    const resultData = await arkResponse.json();
    return Response.json(resultData, { headers: corsHeaders });
  } catch (serverErr) {
    return Response.json({ error: "Server request failed" }, { status: 500, headers: corsHeaders });
  }
}
