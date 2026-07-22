export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  // 你的Shopify店铺源域名，一字不能错
  const ALLOW_ORIGIN = "https://spaceloom.myshopify.com";
  const headers = {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // 处理浏览器OPTIONS预检请求（关键，之前漏完整处理会跨域报错）
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Only POST requests allowed" }, { status: 405, headers });
  }

  const arkApiKey = process.env.ARK_API_KEY;
  console.log("=====环境变量检测=====");
  console.log("ARK_API_KEY 是否存在：", Boolean(arkApiKey));

  if (!arkApiKey) {
    return Response.json({ error: "Missing ARK_API_KEY env variable" }, { status: 500, headers });
  }

  let userPrompt;
  try {
    const body = await req.json();
    userPrompt = body.userPrompt;
  } catch (e) {
    return Response.json({ error: "Request body parse failed" }, { status: 400, headers });
  }

  const epId = "ep-20260722205932-hwkh5";
  const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  try {
    const res = await fetch(arkUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${arkApiKey}`,
        "Content-Type": "application/json",
        "X-Volc-ARK-Endpoint-Id": epId
      },
      body: JSON.stringify({
        model: epId,
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

    const data = await res.json();
    console.log("火山返回完整数据：", JSON.stringify(data));
    return Response.json(data, { headers });
  } catch (err) {
    const errInfo = JSON.stringify(err, Object.getOwnPropertyNames(err));
    console.error("请求异常完整信息：", errInfo);
    return Response.json({ error: "Server error", detail: errInfo }, { status: 500, headers });
  }
}
