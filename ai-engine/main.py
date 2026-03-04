import os
from dotenv import load_dotenv  
import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn
from google import genai
from google.genai import types
from google.cloud import discoveryengine_v1 as discoveryengine

# Put the glasses on! Forces Python to read your .env file
load_dotenv()

# Initialize Firebase Admin
firebase_admin.initialize_app(options={"projectId": "farmersmark-agriculture"})
db = firestore.client()

# Initialize Google GenAI client
api_key = os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

@https_fn.on_call()
def analyzeDocument(req: https_fn.CallableRequest):
    """
    HTTP Callable Function for RAG-based document analysis using Vertex AI Agent Builder.
    """
    try:
        data = req.data
        question = data.get("question")
        
        if not question:
            return {"error": "Missing question in request."}

        print(f"🔍 Searching Cloud Corpus for: {question}")
        
        # =====================================================================
        # 1. RETRIEVAL STEP: Ask Vertex AI to search your PDFs
        # =====================================================================
        project_id = "farmersmark-agriculture"
        location = "global"
        data_store_id = "farmersmark-corpus_1771773076319" 
        
        search_client = discoveryengine.SearchServiceClient()
        serving_config = search_client.serving_config_path(
            project=project_id,
            location=location,
            data_store=data_store_id,
            serving_config="default_config",
        )

        # 👇 THE FIX: Force Google to return the actual paragraphs!
        content_search_spec = discoveryengine.SearchRequest.ContentSearchSpec(
            snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                return_snippet=True
            ),
            extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
                max_extractive_answer_count=1,
                max_extractive_segment_count=2, # Grab the 2 best paragraphs
            )
        )

        request = discoveryengine.SearchRequest(
            serving_config=serving_config,
            query=question,
            page_size=5, 
            content_search_spec=content_search_spec # Inject the spec here
        )
        
        search_results = search_client.search(request)
        
        # Extract the juicy text paragraphs from the search results
        retrieved_text = ""
        for result in search_results.results:
            # 1. Grab the large Extractive Segments (Best for RAG)
            segments = result.document.derived_struct_data.get("extractive_segments", [])
            for segment in segments:
                retrieved_text += segment.get("content", "") + "\n\n"
                
            # 2. Grab the smaller Snippets just in case
            snippets = result.document.derived_struct_data.get("snippets", [])
            for snippet in snippets:
                clean_text = snippet.get("snippet", "").replace("<b>", "").replace("</b>", "")
                retrieved_text += clean_text + "\n\n"

        if not retrieved_text.strip():
            return {"answer": "I'm sorry, but I couldn't find any relevant information regarding that in the official compliance documents."}

        # =====================================================================
        # 2. GENERATION STEP: Call Gemini 2.0 Flash to formulate the answer
        # =====================================================================
        prompt = f"""
        You are an expert agricultural assistant. Answer the user's question based STRICTLY on the retrieved context provided below.
        If the answer is not in the context, say that you don't know based on the available information.

        Context:
        {retrieved_text}

        User Question:
        {question}
        """

        print("🤖 Generating answer...")
        generate_response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8192,
            )
        )

        print("✅ Answer successfully generated!")
        return {"answer": generate_response.text}

    except Exception as e:
        print(f"❌ Error in analyzeDocument: {str(e)}")
        return {"error": str(e)}