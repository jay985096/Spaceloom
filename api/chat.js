export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Only POST requests allowed" }, { status: 405 });
  }

  const arkApiKey = process.env.ARK_API_KEY;
  console.log("【密钥检测】", Boolean(arkApiKey));
  if (!arkApiKey) {
    return Response.json({ error: "Missing ARK_API_KEY env" }, { status: 500 });
  }

  let userPrompt;
  try {
    const body = await req.json();
    userPrompt = body.userPrompt;
  } catch (e) {
    return Response.json({ error: "Parse request body failed" }, { status: 400 });
  }

  const endpointId = "ep-20260722205932-hwkh5";
  const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  try {
    const res = await fetch(arkUrl, {
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

    const data = await res.json();
    console.log("【火山完整返回】", JSON.stringify(data));
    return Response.json(data);
  } catch (err) {
    const errInfo = JSON.stringify(err, Object.getOwnPropertyNames(err));
    console.error("接口异常：", errInfo);
    return Response.json({ error: "Server error", detail: errInfo }, { status: 500 });
  }
}
