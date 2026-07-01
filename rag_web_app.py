import streamlit as st
from openai import AzureOpenAI
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
import os

# 웹 페이지 레이아웃 및 테마 설정
st.set_page_config(page_title="실시간 RAG 문서 챗봇", page_icon="📑", layout="wide")

# 대화 기록 세션 초기화
if "messages" not in st.session_state:
    st.session_state["messages"] = [
        {"role": "assistant", "content": "안녕하세요! 위에 문서를 업로드해 주시면 내용을 분석하여 똑똑하게 답변해 드립니다."}
    ]

# 추천 질문 버튼 작동을 위한 입력값 임시 저장소 세션 초기화
if "suggested_question" not in st.session_state:
    st.session_state["suggested_question"] = ""

# 추천 질문 클릭 시 실행되는 콜백 함수
def select_suggested_question(q):
    st.session_state["suggested_question"] = q

# 중복 OCR 호출 방지를 위한 캐싱 데코레이터 적용
@st.cache_data(show_spinner="문서 분석 중 (Azure OCR 작동)... ⏳")
def get_ocr_text(file_bytes, endpoint, key):
    try:
        client = DocumentIntelligenceClient(
            endpoint=endpoint, 
            credential=AzureKeyCredential(key)
        )
        poller = client.begin_analyze_document(
            "prebuilt-read", 
            AnalyzeDocumentRequest(bytes_source=file_bytes)
        )
        result = poller.result()
        return result.content if result.content else ""
    except Exception as e:
        return f"[OCR 분석 중 오류 발생]: {str(e)}"

# 사이드바 영역 설정 - 설정을 모두 숨겨 일반 사용자용 가이드만 배치
with st.sidebar:
    st.title("🤖 RAG 챗봇 안내")
    st.write("본 웹서비스는 업로드된 문서 보안과 빠른 인공지능 분석을 보장합니다.")
    st.divider()
    st.markdown("""
    ### 💡 사용 방법
    1. 메인 화면에서 원하는 **문서나 이미지**를 업로드합니다.
    2. 추천 질문 버튼을 클릭하거나 대화창에서 질문을 던집니다.
    3. AI가 문서 내용을 학습하여 답변을 출력합니다.
    """)
    st.divider()
    st.caption("🔒 모든 자격 증명(API Key)은 보안 처리되어 서버 내부에서 안전하게 실행됩니다.")

# 메인 화면 영역 설정
st.title("📑 실시간 RAG 문서 업로더 & 챗봇")
st.write("문서를 업로드하면 실시간으로 OCR 처리 후 그 기반으로 챗봇이 자동 생성됩니다.")

# 1. secrets.toml 파일에서 보안 자격 증명 로드 (Azure OCR & Azure OpenAI)
try:
    ocr_endpoint = st.secrets["azure_ocr"]["endpoint"]
    ocr_key = st.secrets["azure_ocr"]["key"]
    
    llm_endpoint = st.secrets["azure_openai"]["endpoint"]
    llm_key = st.secrets["azure_openai"]["key"]
    llm_deployment = st.secrets["azure_openai"]["deployment_name"]
    llm_api_version = st.secrets["azure_openai"]["api_version"]
    
    # 템플릿 안내 문구가 그대로 있으면 설정 오류로 판단
    if "여기에" in llm_endpoint or "여기에" in llm_key or "여기에" in llm_deployment:
        has_config = False
    else:
        has_config = True
except Exception:
    has_config = False

if not has_config:
    st.error("⚠️ [설정 오류] `.streamlit/secrets.toml` 파일에 Azure OCR 및 Azure OpenAI 설정 정보를 올바르게 입력해 주세요.")
    st.info("비밀번호 및 자격 증명 설정 파일 링크: [.streamlit/secrets.toml](file:///C:/dev/.streamlit/secrets.toml) 파일을 열어서 실제 키를 채워 넣으시면 바로 작동합니다.")
    st.stop()

# 2. 실시간 파일 업로더 생성
uploaded_file = st.file_uploader(
    "여기에 분석하고 싶은 파일을 올려주세요 (PDF, JPG, PNG, BMP, TIFF, DOCX, XLSX, PPTX 지원)",
    type=["pdf", "jpg", "jpeg", "png", "bmp", "tiff", "docx", "xlsx", "pptx", "html"]
)

document_text = ""

# 파일이 업로드된 경우 실시간 OCR 처리
if uploaded_file is not None:
    file_bytes = uploaded_file.read()
    
    # 캐싱된 OCR 함수 호출 (보안이 적용된 키 사용)
    document_text = get_ocr_text(file_bytes, ocr_endpoint, ocr_key)
    
    if "[OCR 분석 중 오류 발생]" in document_text:
        st.error(document_text)
        document_text = ""
    else:
        st.success(f"🎉 문서 분석 및 OCR 완료! (추출된 텍스트: {len(document_text)} 자)")
        with st.expander("📝 추출된 문서 원본 보기"):
            st.text_area("OCR 결과 텍스트", value=document_text, height=200, disabled=True)
            
        # RAG 추천 질문 버튼 추가 (문서 분석이 완료된 시점에 렌더링)
        st.write("")
        st.write("💡 **이런 질문은 어떠신가요? 클릭하여 바로 물어보세요!**")
        cols = st.columns(3)
        
        q1 = "📝 문서 핵심 내용을 3줄로 요약해 줘"
        q2 = "🎯 주요 업무와 핵심 지원 자격 요건은 뭐야?"
        q3 = "🎁 우대사항 및 복지 혜택 같은 특이사항이 있어?"
        
        cols[0].button(q1, use_container_width=True, on_click=select_suggested_question, args=(q1,))
        cols[1].button(q2, use_container_width=True, on_click=select_suggested_question, args=(q2,))
        cols[2].button(q3, use_container_width=True, on_click=select_suggested_question, args=(q3,))

st.divider()

# 이전 대화 히스토리 화면에 렌더링
for msg in st.session_state.messages:
    st.chat_message(msg["role"]).write(msg["content"])

# 사용자 입력 처리 (직접 입력창 또는 추천 질문 버튼 클릭 감지)
chat_input_val = st.chat_input("질문을 입력해 주세요...")
prompt = ""

if st.session_state["suggested_question"]:
    prompt = st.session_state["suggested_question"]
    st.session_state["suggested_question"] = ""  # 질문 사용 후 초기화
elif chat_input_val:
    prompt = chat_input_val

# 질문이 생성되었을 때 처리 시작
if prompt:
    if not document_text:
        st.info("먼저 분석할 문서를 위에 드래그 앤 드롭으로 업로드해 주세요.")
        st.stop()

    # 사용자의 질문을 화면에 표시하고 기록에 저장
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.chat_message("user").write(prompt)

    try:
        # secrets에서 가져온 보안 데이터 기반으로 Azure OpenAI 클라이언트 초기화
        client = AzureOpenAI(
            azure_endpoint=llm_endpoint,
            api_key=llm_key,
            api_version=llm_api_version
        )
        
        # 시스템 프롬프트에 문서 텍스트(Context)를 주입
        system_instruction = f"""
        당신은 제공된 문서를 바탕으로 사용자의 질문에 답하는 비서입니다.
        아래 [참조 문서 내용]을 바탕으로 사용자의 질문에 친절하고 상세하게 답변해 주세요.
        
        [답변 규칙]
        1. 반드시 한국어로 답변해 주세요.
        2. 문서에 명시되지 않은 정보는 억지로 지어내지 말고, 솔직하게 "제공된 문서 내용에서는 해당 정보를 찾을 수 없습니다."라고 답변해 주세요.
        3. 문서의 텍스트에 기반하여 팩트 위주로 대답해 주세요.
        
        [참조 문서 내용]
        {document_text}
        """

        # API에 전달할 대화 목록 구성
        api_messages = [
            {"role": "system", "content": system_instruction}
        ]
        
        # 최근 대화 히스토리 컨텍스트에 추가
        for msg in st.session_state.messages[-5:]:
            api_messages.append({"role": msg["role"], "content": msg["content"]})

        # 답변 생성 중 스피너 표시
        with st.chat_message("assistant"):
            with st.spinner("답변을 생성하는 중..."):
                response = client.chat.completions.create(
                    model=llm_deployment,
                    messages=api_messages
                )
                answer = response.choices[0].message.content
                st.write(answer)
                
        # 생성된 답변 기록에 저장
        st.session_state.messages.append({"role": "assistant", "content": answer})
        
        # Streamlit 화면 강제 리프레시로 정상 렌더링 유지
        st.rerun()
        
    except Exception as e:
        st.error(f"오류가 발생했습니다: {e}")
