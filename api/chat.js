import { ArkService, ChatMessageRole } from "@volcengine/ark-runtime";

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  // 改成你的shopify店铺域名 https://xxx.myshopify.com
  const shopifyDomain = "https://替换成你的店铺.myshopify.com";
  const headers = {
    "Access-Control-Allow-Origin": shopifyDomain,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }
  if (req.method !== "POST") {
    return Response.json({error:"only POST"}, {status:400, headers});
  }

  const { userPrompt } = await req.json();

  const ark = ArkService.builder()
    .apiKey(`${process.env.VOLC_ACCESS_KEY_ID}:${process.env.VOLC_SECRET_KEY}`)
    .region("cn-beijing")
    .build();

  const systemPrompt = `
You are a professional North American furniture matching consultant.
Users will input room size, interior style, budget, room type.
Recommend matched furniture.
Remind users to click links to view products on Wayfair.
All reply use English, output clean and easy to read.
`;

  const chatReq = {
    model: process.env.ARK_ENDPOINT_ID,
    messages: [
      {role: ChatMessageRole.SYSTEM, content: systemPrompt},
      {role: ChatMessageRole.USER, content: userPrompt}
    ],
    temperature: 0.7
  };

  try {
    const result = await ark.createChatCompletion(chatReq);
    const reply = result.choices[0].message.content;
    return Response.json({reply}, {headers});
  } catch (err) {
    return Response.json({error: err.message}, {status:500, headers});
  }
}
