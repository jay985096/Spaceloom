export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  // 严格匹配你的Shopify域名，无多余符号
  const ALLOW_ORIGIN = "https://spaceloom.myshopify.com";
  // 所有响应统一携带跨域头部，包含OPTIONS预检
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // 【核心修复点1】单独处理浏览器OPTIONS预检请求，直接返回200+跨域头
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 限制仅POST请求
  if (req.method !== "POST") {
    return Response.json(
      { error: "Only POST requests are supported" },
      { status: 405, headers: corsHeaders }
    );
  }

  // 读取密钥并打印日志
  const arkApiKey = process.env.ARK_API_KEY;
  console.log("ARK_API_KEY 是否读取成功：", Boolean(arkApiKey));
  if (!arkApiKey) {
    return Response.json(
      { error: "Missing ARK_API_KEY environment variable" },
      { status: 500, headers: corsHeaders }
    );
  }

  // 解析前端入参
  let userPrompt;
  try {
    const body = await req.json();
    userPrompt = body.userPrompt;
  } catch (parseErr) {
    return Response.json(
      { error: "Failed to parse request body" },
      { status: 400, headers: corsHeaders }
    );
  }

  // 火山方舟固定配置
  const endpointId = "ep-20260722205932-hwkh5";
  const arkApiUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  try {
    // 请求大模型
    const arkRes = await fetch(arkApiUrl, {
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
            content: "You are a professional North American indoor furniture matching designer. All output must be written in English. Provide personalized furniture matching plans based on customer budget, house type, room size, style preference and functional demands, and guide customers to buy matching furniture on Wayfair."
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    const data = await arkRes.json();
    console.log("【火山完整返回】", JSON.stringify(data));
    // 返回前端时强制附加跨域头
    return Response.json(data, { headers: corsHeaders });

  } catch (fetchErr) {
    // 序列化完整错误日志，避免undefined报错
    const errDetail = JSON.stringify(fetchErr, Object.getOwnPropertyNames(fetchErr));
    console.error("【请求异常完整信息】", errDetail);
    return Response.json(
      { error: "Server request failed", detail: errDetail },
      { status: 500, headers: corsHeaders }
    );
  }
}
