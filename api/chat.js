console.log("=====环境变量检测=====");
console.log("AK是否读取成功：", !!process.env.VOLC_ACCESS_KEY_ID);
console.log("SK是否读取成功：", !!process.env.VOLC_SECRET_KEY);
console.log("EP_ID是否读取成功：", !!process.env.ARK_ENDPOINT_ID);

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

  const accessKeyId = process.env.VOLC_ACCESS_KEY_ID;
  const secretKey = process.env.VOLC_SECRET_KEY;
  const epId = process.env.ARK_ENDPOINT_ID;

  // 前置校验密钥是否存在
  if (!accessKeyId || !secretKey || !epId) {
    return Response.json({ error: "Missing AK/SK/EP_ID env variable" }, { status: 500, headers });
  }

  const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const auth = `Bearer ${accessKeyId}${secretKey}`;

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
    // 打印火山返回完整响应，方便定位鉴权报错
    console.log("火山接口返回数据：", JSON.stringify(data, null, 2));
    return Response.json(data, { headers });
  } catch (err) {
    // 完整打印错误文本，不再只输出 [object Object]
    console.error("完整异常信息：", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return Response.json({ error: "Server internal error", detail: String(err) }, { status: 500, headers });
  }
}
