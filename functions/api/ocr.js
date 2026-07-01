export async function onRequestPost(context) {
  try {
    const ocrKey = context.env.AZURE_OCR_KEY;
    const ocrEndpoint = context.env.AZURE_OCR_ENDPOINT;

    if (!ocrKey || !ocrEndpoint) {
      return new Response(JSON.stringify({ error: "Cloudflare 환경변수(AZURE_OCR_KEY, AZURE_OCR_ENDPOINT)가 설정되지 않았습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 클라이언트가 보낸 파일 바이너리(ArrayBuffer) 읽기
    const fileBuffer = await context.request.arrayBuffer();

    let endpointClean = ocrEndpoint.replace(/\/$/, "");
    const ocrUrl = `${endpointClean}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`;

    // 1. Azure OCR 문서 분석 등록 요청 (POST)
    const submitResponse = await fetch(ocrUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": ocrKey,
        "Content-Type": "application/octet-stream"
      },
      body: fileBuffer
    });

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      return new Response(JSON.stringify({ error: `Azure OCR 제출 실패: ${errText}` }), {
        status: submitResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 분석 작업 위치 헤더 파싱
    const operationLocation = submitResponse.headers.get("Operation-Location");
    if (!operationLocation) {
      return new Response(JSON.stringify({ error: "분석 작업 위치(Operation-Location)를 획득하지 못했습니다." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. 백엔드 내부 상태 폴링 (최대 10회, 1.5초 간격)
    let status = "notStarted";
    let resultData = null;
    
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5초 대기

      const statusResponse = await fetch(operationLocation, {
        headers: {
          "Ocp-Apim-Subscription-Key": ocrKey
        }
      });

      if (!statusResponse.ok) {
        throw new Error("OCR 상태 파싱 실패");
      }

      resultData = await statusResponse.json();
      status = resultData.status;

      if (status === "succeeded") {
        break;
      }
      if (status === "failed") {
        return new Response(JSON.stringify({ error: "Azure OCR 분석 상태가 실패로 반환되었습니다." }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (status !== "succeeded") {
      return new Response(JSON.stringify({ error: "OCR 분석 대기 시간 초과 (대용량 파일이거나 지연 발생)" }), {
        status: 408,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. 성공 시 추출된 콘텐츠 반환
    const extractedText = resultData.analyzeResult.content || "";
    return new Response(JSON.stringify({ content: extractedText }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
