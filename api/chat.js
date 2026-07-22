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

  const { userPrompt } = await req.json();
  const accessKeyId = process.env.VOLC_ACCESS_KEY_ID;
  const secretKey = process.env.VOLC_SECRET_KEY;
  const epId = process.env.ARK_ENDPOINT_ID;

  const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  // 重点：AK和SK中间无冒号，直接拼接
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
    return Response.json(data, { headers });
  } catch (err) {
    console.error("接口调用异常：", err);
    return Response.json({ error: "Server internal error" }, { status: 500, headers });
  }
}
