export const config = {
  runtime: "edge",
  // 限制接口最大执行时长，提前中断避免504
  maxDuration: 8
};

// 允许的前端域名白名单
const ALLOWED_ORIGINS = ["https://spaceloom.myshopify.com"];
const CORS_MAX_AGE = 86400; // 预检请求缓存24小时

// 统一生成CORS头部函数
function getCorsHeaders(origin) {
  const isOriginAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": isOriginAllowed ? origin : "",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": CORS_MAX_AGE.toString(),
  };
}

// 统一封装返回响应，自动注入跨域头
function createResponse(data, status = 200, req) {
  const origin = req.headers.get("origin") || "";
  const headers = getCorsHeaders(origin);
  return Response.json(data, { status, headers });
}

export default async function handler(req) {
  const requestOrigin = req.headers.get("origin") || "";
  const corsHeaders = getCorsHeaders(requestOrigin);

  // 处理OPTIONS预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 仅允许POST
  if (req.method !== "POST") {
    return createResponse({ error: "Only POST requests allowed" }, 405, req);
  }

  const arkApiKey = process.env.ARK_API_KEY;
  if (!arkApiKey) {
    return createResponse({ error: "Missing ARK_API_KEY environment variable" }, 500, req);
  }

  let userPrompt;
  try {
    const body = await req.json();
    userPrompt = body.userPrompt;
    if (!userPrompt) throw new Error("Empty user prompt");
  } catch (parseErr) {
    return createResponse({ error: "Failed to parse input or empty prompt" }, 400, req);
  }

  const endpointId = "ep-20260722205932-hwkh5";
  const arkApiUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

  // 大模型请求配置，设置5秒超时防止Edge超时504
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const arkResponse = await fetch(arkApiUrl, {
      method: "POST",
      signal: controller.signal,
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

    clearTimeout(timeoutId);

    // 捕获火山方舟接口报错（4xx/5xx）
    if (!arkResponse.ok) {
      const errInfo = await arkResponse.text();
      return createResponse({
        error: "VolcEngine ARK API request failed",
        detail: errInfo,
        arkStatus: arkResponse.status
      }, 502, req);
    }

    const resultData = await arkResponse.json();
    return createResponse(resultData, 200, req);

  } catch (serverErr) {
    clearTimeout(timeoutId);
    // 区分超时错误和普通服务错误
    if (serverErr.name === "AbortError") {
      return createResponse({ error: "Request timeout, please try again later" }, 504, req);
    }
    return createResponse({ error: "Server internal error", detail: serverErr.message }, 500, req);
  }
}
