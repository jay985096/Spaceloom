// api/chat.js
// Vercel Serverless Function：拉 Shopify 商品 + 调用火山方舟(Ark)大模型 + 返回推荐结果

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_MODEL_ID = process.env.ARK_MODEL_ID;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const ARK_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const SHOPIFY_API_VERSION = "2024-10";

export default async function handler(req, res) {
  // ---------- CORS ----------
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ---------- 校验环境变量 ----------
  if (!ARK_API_KEY || !ARK_MODEL_ID || !SHOPIFY_STORE_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
    return res.status(500).json({
      error: "Missing required environment variables. Check Vercel project settings.",
    });
  }

  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' in request body" });
    }

    // ---------- 第一步：从 Shopify 拉商品数据 ----------
    const products = await fetchShopifyProducts();

    // ---------- 第二步：调用火山方舟大模型 ----------
    const aiResult = await callArkModel(message, products);

    return res.status(200).json(aiResult);
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err.message || err) });
  }
}

// 拉取 Shopify 商品列表（Storefront API）
async function fetchShopifyProducts() {
  const query = `
    query {
      products(first: 20, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            description
            handle
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            featuredImage {
              url
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data.products.edges.map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    description: (edge.node.description || "").slice(0, 200),
    handle: edge.node.handle,
    price: edge.node.priceRange.minVariantPrice.amount,
    currency: edge.node.priceRange.minVariantPrice.currencyCode,
    image: edge.node.featuredImage?.url || null,
    url: `https://${SHOPIFY_STORE_DOMAIN}/products/${edge.node.handle}`,
  }));
}

// 调用火山方舟 Ark（OpenAI 兼容接口）
async function callArkModel(userMessage, products) {
  const productListText = products
    .map((p, i) => `${i + 1}. ${p.title} - ${p.price} ${p.currency} - ${p.description}`)
    .join("\n");

  const systemPrompt = `你是一个电商导购助手。只能根据下面提供的真实商品列表来回答和推荐商品，
禁止编造任何不在列表中的商品信息。如果列表中没有合适的商品，要如实告诉用户店里暂时没有相关商品，
不要编造。回答要简洁、口语化，像真人导购一样。

商品列表：
${productListText}`;

  const response = await fetch(ARK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: ARK_MODEL_ID,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ark API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || "抱歉，我暂时无法回答，请稍后再试。";

  return {
    reply,
    products, // 前端可以用这个列表渲染带链接的推荐卡片
  };
}
