"""
이 코드 샘플은 Azure AI Document Intelligence 클라이언트 라이브러리를 사용하여 Prebuilt Read 작업을 수행하는 방법을 보여줍니다.
비동기 버전의 샘플은 Python 3.8 이상이 필요합니다.

자세한 내용은 다음 문서를 참조하세요. - Quickstart: Document Intelligence (formerly Form Recognizer) SDKs
https://learn.microsoft.com/azure/ai-services/document-intelligence/quickstarts/get-started-sdks-rest-api?pivots=programming-language-python
"""

from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
import numpy as np
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

"""
작업이 끝나면 코드에서 키를 반드시 제거하고, 공개적으로 게시하지 마세요. 프로덕션 환경의 경우
자격 증명을 안전하게 저장하고 액세스하는 안전한 방법을 사용하세요. 자세한 내용은 다음을 참조하세요.
https://docs.microsoft.com/en-us/azure/cognitive-services/cognitive-services-security?tabs=command-line%2Ccsharp#environment-variables-and-application-configuration
"""
endpoint = "YOUR_AZURE_OCR_ENDPOINT"
key = "YOUR_AZURE_OCR_KEY"
def format_bounding_box(bounding_box):
    if not bounding_box:
        return "N/A"
    reshaped_bounding_box = np.array(bounding_box).reshape(-1, 2)
    return ", ".join(["[{}, {}]".format(x, y) for x, y in reshaped_bounding_box])

def analyze_read():
    # 로컬 문서 경로 (경로 맨 앞에 r을 붙여 unicode escape 에러를 방지합니다)
    local_file_path = r"C:\Users\EL061\Downloads\['26년 6월] SK하이닉스 Talent hy-way(신입) Job Description.pdf"

    # 로컬 파일을 바이너리(bytes)로 읽어옵니다
    with open(local_file_path, "rb") as f:
        file_bytes = f.read()

    document_intelligence_client  = DocumentIntelligenceClient(
        endpoint=endpoint, credential=AzureKeyCredential(key)
    )
    
    # url_source 대신 bytes_source를 사용하여 로컬 파일 데이터를 전달합니다
    poller = document_intelligence_client.begin_analyze_document(
        "prebuilt-read", AnalyzeDocumentRequest(bytes_source=file_bytes)
    )
    result = poller.result()

    print("문서에 포함된 콘텐츠: ", result.content)

    # 추출된 텍스트를 RAG에 사용하기 위해 파일로 저장합니다
    with open("extracted_text.txt", "w", encoding="utf-8") as f:
        f.write(result.content if result.content else "")
    print("\n[안내] 추출된 텍스트가 'extracted_text.txt' 파일로 성공적으로 저장되었습니다.")

    for idx, style in enumerate(result.styles):
        print(
            "문서에 {} 콘텐츠가 포함되어 있습니다.".format(
                "필기체" if style.is_handwritten else "필기체 아님"
            )
        )

    for page in result.pages:
        print("----{}페이지 분석 중----".format(page.page_number))
        print(
            "페이지 너비: {}, 높이: {}, 측정 단위: {}".format(
                page.width, page.height, page.unit
            )
        )

        for line_idx, line in enumerate(page.lines):
            print(
                "...{}번째 줄 텍스트: '{}', 바운딩 박스: '{}'".format(
                    line_idx,
                    line.content,
                    format_bounding_box(line.polygon),
                )
            )

        for word in page.words:
            print(
                "...단어 '{}' (신뢰도: {})".format(
                    word.content, word.confidence
                )
            )

    print("----------------------------------------")


if __name__ == "__main__":
    analyze_read()
