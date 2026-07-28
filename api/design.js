// api/design.js
// 根据客户需求：1) 从商品库里挑相关商品 + 生成推荐理由  2) 生成一张整体方案氛围图
// 商品数据来源目前是 data/wayfair-catalog-sample.json（占位样例）
// 等 Wayfair/CJ Affiliate 数据接口就绪后，把 loadCatalog() 换成真实数据源即可，其余逻辑不用改

import catalogData from "../data/wayfair-catalog-sample.json" with { type: "json" };

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_MODEL_ID = process.env.ARK_MODEL_ID;
const ARK_IMAGE_MODEL_ID = process.env.ARK_IMAGE_MODEL_ID || "doubao-seedream-4-0-250828";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const ARK_CHAT_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const ARK_IMAGE_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

export default async function handler(req, res) {
  // ---------- CORS ----------
  const requestOrigin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!ARK_API_KEY || !ARK_MODEL_ID) {
    return res.status(500).json({ error: "Missing ARK environment variables" });
  }

  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' in request body" });
    }

    const catalog = loadCatalog();

    // 第一步：用大模型挑选相关商品 + 生成推荐理由
    const { products, reasoning } = await pickProducts(message, catalog);

    if (products.length === 0) {
      return res.status(200).json({
        reasoning: "抱歉，暂时没有找到匹配的商品，可以换个描述再试试～",
        products: [],
        image: null,
      });
    }

    // 第二步：用挑出来的商品图生成一张整体方案氛围图
    const image = await generateDesignImage(message, products);

    return res.status(200).json({ reasoning, products, image });
  } catch (err) {
    console.error("design handler error:", err);
    return res.status(500).json({ error: "Internal server error", detail: String(err.message || err) });
  }
}

function loadCatalog() {
  return catalogData.products || [];
}

// 用大模型根据用户描述，从商品库里挑出最相关的 3-5 件，并给出推荐理由
async function pickProducts(userMessage, catalog) {
  const catalogText = catalog
    .map((p) => `id: ${p.id} | ${p.title} | 分类: ${p.category} | 标签: ${p.tags.join(",")} | 价格: ${p.price} ${p.currency}`)
    .join("\n");

  const systemPrompt = `你是一个家居风格顾问。下面是商品库列表，只能从这个列表里选择商品，禁止编造列表之外的商品。
根据用户的描述，选出最相关的 3-5 件商品，并说明为什么适合用户的需求。
必须以严格的 JSON 格式输出，不要有任何多余文字，格式如下：
{"reasoning": "一段简短的整体推荐理由（中文，2-3句话）", "product_ids": ["id1", "id2", "id3"]}

商品库：
${catalogText}`;

  const response = await fetch(ARK_CHAT_ENDPOINT, {
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
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ark chat error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "{}";

  let parsed;
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    parsed = { reasoning: "", product_ids: [] };
  }

  const idSet = new Set(parsed.product_ids || []);
  const products = catalog.filter((p) => idSet.has(p.id));

  return { products, reasoning: parsed.reasoning || "" };
}

// 用挑出的商品图作为参考，生成一张整体方案氛围图
// 注意：这里先用"以第一件商品图为参考图"的单图 image-to-image 方式（这是官方文档已确认的调用方式）
// 火山方舟同时支持"多图融合"生成，但具体传参格式还需要在正式接入 Wayfair 真实图片前，对照最新官方文档核实一次，
// 避免用未经验证的参数格式导致线上报错。
async function generateDesignImage(userMessage, products) {
  const heroImage = products[0]?.image;

  const prompt = `根据以下家居需求和商品搭配，生成一张温馨自然、写实风格的室内设计效果图，整体色调和材质呼应真实木质与织物质感：${userMessage}`;

  const body = {
    model: ARK_IMAGE_MODEL_ID,
    prompt,
    size: "2K",
    response_format: "url",
    watermark: false,
  };

  if (heroImage) {
    body.image = heroImage;
  }

  const response = await fetch(ARK_IMAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Ark image error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.data?.[0]?.url || null;
}
