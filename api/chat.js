export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Only POST allowed" }, { status: 405 });
  }

  const arkApiKey = process.env.ARK_API_KEY;
  console.log("ARK_API_KEY 是否读取成功：", Boolean(arkApiKey));

  if (!arkApiKey) {
    return Response.json({ error: "Missing ARK_API_KEY" }, { status: 500 });
  }

  let userPrompt;
  try {
    const body = await req.json();
    userPrompt = body.userPrompt;
  } catch (err) {
    return Response.json({ error: "Parse input failed" }, { status: 400 });
  }

  const endpointId = "ep-20260722205932-hwkh5";
  const arkApiUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  try {
    const res = await fetch(arkApiUrl, {
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
            content: "You are a professional North American indoor furniture matching designer. All replies must be English. Provide personalized furniture plans based on customer budget, house type, room size, style and functional needs, and guide users to buy furniture on Wayfair."
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
      })
    });

    const data = await res.json();
    console.log("火山完整返回：", JSON.stringify(data));
    return Response.json(data);
  } catch (err) {
    console.error("接口异常：", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
