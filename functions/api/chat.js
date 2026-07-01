export async function onRequestPost(context) {
  try {
    const openaiKey = context.env.AZURE_OPENAI_KEY;
    const openaiEndpoint = context.env.AZURE_OPENAI_ENDPOINT;
    const openaiDeployment = context.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const openaiApiVersion = context.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    if (!openaiKey || !openaiEndpoint || !openaiDeployment) {
      return new Response(JSON.stringify({ error: "Cloudflare 환경변수(AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME)가 설정되지 않았습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 클라이언트가 보낸 메시지 페이로드 읽기
    const requestData = await context.request.json();
    const messages = requestData.messages;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "올바르지 않은 메시지 페이로드 양식입니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let endpointClean = openaiEndpoint.replace(/\/$/, "");
    const aiUrl = `${endpointClean}/openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiApiVersion}`;

    // Azure OpenAI Chat Completion API 대행 호출
    const response = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "api-key": openaiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Azure OpenAI 호출 실패: ${errText}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const resData = await response.json();
    return new Response(JSON.stringify(resData), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
