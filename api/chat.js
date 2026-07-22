console.log("=====环境变量检测=====");
console.log("ARK_API_KEY是否读取成功：", !!process.env.ARK_API_KEY);

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  const shopifyDomain = "https://spaceloom.myshopify.com";
  const headers = {
    "Access-Control-Allow-Origin": shopifyDomain,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return Response.json({ error: "Only POST allowed" }, { status: 400, headers });

  let userPrompt;
  try {
    const body = await req.json();
    userPrompt = body.userPrompt;
  } catch (e) {
    return Response.json({ error: "Request body parse failed" }, { status: 400, headers });
  }

  const apiKey = process.env.ARK_API_KEY;
  const epId = "ep-20260722205932-hwkh5";

  if (!apiKey) {
    return Response.json({ error: "Missing ARK_API_KEY env variable" }, { status: 500, headers });
  }

  const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const auth = `Bearer ${apiKey}`;

  try {
    const res = await fetch(arkUrl, {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
        "X-Volc-Ark-Endpoint-Id": epId
      },
      body: JSON.stringify({
        model: epId,
        messages: [
          {
            role: "system",
            content: "You are a professional North American indoor furniture matching designer. All output must be in English. Recommend furniture that matches the customer's budget, house type and style, and finally guide customers to buy on Wayfair."
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await res.json();
    console.log("【火山完整返回】", JSON.stringify(data, null, 2));
    return Response.json(data, { headers });
  } catch (err) {
    // 重点：序列化完整错误，不再显示 [object Object]
    const fullErr = JSON.stringify(err, Object.getOwnPropertyNames(err));
    console.error("【请求异常完整信息】", fullErr);
    return Response.json({ error: "Server internal error", detail: fullErr }, { status: 500, headers });
  }
}
