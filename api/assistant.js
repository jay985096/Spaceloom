// /api/assistant.js
// Vercel Serverless Function (Node.js runtime)
// 作用：Shopify 前端小组件 -> 本接口 -> 火山方舟 Ark 大模型
//
// 需要在 Vercel 项目的 Environment Variables 中配置：
//   ARK_API_KEY         火山方舟 API Key
//   ARK_MODEL_ID         你在火山方舟选好的模型接入点 ID（Endpoint ID，形如 ep-xxxxxxxx），
//                        或直接填模型名（如 doubao-1-5-lite-32k），取决于你开通的方式
//   SHOPIFY_STORE_DOMAIN Shopify 店铺域名，如 your-store.myshopify.com
//   SHOPIFY_STOREFRONT_TOKEN  Shopify Storefront API 的 Access Token（公开只读，用于查商品）
//   ALLOWED_ORIGIN       允许跨域访问的来源，如 https://your-store.myshopify.com（生产环境务必设置，不要用 *）

const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

export default async function handler(req, res) {
  // ---- CORS ----
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "缺少 message 字段" });
    }

    // 1. 从 Shopify 拉取商品数据作为上下文（简单关键词搜索，取前 10 个）
    const products = await fetchShopifyProducts(message);

    // 2. 组装 system prompt，要求模型输出结构化 JSON
    const systemPrompt = buildSystemPrompt(products);

    // 3. 调用火山方舟 Ark Chat Completions（OpenAI 兼容格式）
    const arkResp = await fetch(ARK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ARK_MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.slice(-6), // 保留最近几轮对话
          { role: "user", content: message },
        ],
        temperature: 0.6,
      }),
    });

    if (!arkResp.ok) {
      const errText = await arkResp.text();
      console.error("Ark API error:", errText);
      return res.status(502).json({ error: "模型调用失败", detail: errText });
    }

    const arkData = await arkResp.json();
    const rawText = arkData?.choices?.[0]?.message?.content || "";

    // 4. 尝试解析结构化结果；解析失败则直接返回原文
    let structured;
    try {
      structured = JSON.parse(rawText);
    } catch {
      structured = { reply: rawText, recommended_products: [] };
    }

    return res.status(200).json({
      reply: structured.reply || rawText,
      recommended_products: structured.recommended_products || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "服务器内部错误" });
  }
}

// 通过 Shopify Storefront API（GraphQL）按关键词搜索商品
async function fetchShopifyProducts(query) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!domain || !token) return [];

  const gql = `
    query searchProducts($query: String!) {
      products(first: 10, query: $query) {
        edges {
          node {
            title
            handle
            description
            onlineStoreUrl
            priceRange {
              minVariantPrice { amount currencyCode }
            }
          }
        }
      }
    }
  `;

  try {
    const resp = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query: gql, variables: { query } }),
    });
    const data = await resp.json();
    return (data?.data?.products?.edges || []).map((e) => e.node);
  } catch (err) {
    console.error("Shopify fetch error:", err);
    return [];
  }
}

function buildSystemPrompt(products) {
  const catalog = products
    .map(
      (p, i) =>
        `${i + 1}. ${p.title} | 价格: ${p.priceRange?.minVariantPrice?.amount || "?"} ${
          p.priceRange?.minVariantPrice?.currencyCode || ""
        } | handle: ${p.handle} | 简介: ${(p.description || "").slice(0, 80)}`
    )
    .join("\n");

  return `你是这家 Shopify 店铺的商品推荐/问答助手。
以下是与用户问题相关的商品目录（可能为空）：
${catalog || "（未检索到相关商品，请基于常识礼貌回答，并建议用户换个关键词）"}

请严格输出如下 JSON 格式，不要输出任何多余文字：
{
  "reply": "给用户的自然语言回答，简洁友好，中文",
  "recommended_products": ["商品handle1", "商品handle2"]
}
recommended_products 只能填上面目录中出现过的 handle，没有合适商品时留空数组。`;
}
