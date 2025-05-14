from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langgraph.graph import StateGraph, START, END
from dotenv import load_dotenv
from core import plan_step, execute_step, replan_step, should_end, PlanExecute
from docx import Document
from config import client
from io import BytesIO
from cache import create_redis_index, knn_search, generate_embedding

app = FastAPI()

load_dotenv()
create_redis_index()

# State container
session_state = {
    "plan": [],
    "past_steps": [],
    "current_step_index": 0,
    "response": "",
    "topic": ""
}

def generate_docx(content: str) -> BytesIO:
    doc = Document()
    doc.add_paragraph(content)
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer

def wrapped_plan_step(state: dict) -> dict:
    result = plan_step(state)
    if "plan" in result:
        session_state["plan"] = result["plan"]
    return result

def wrapped_execute_step(state: dict) -> dict:
    result = execute_step(state)
    if "plan" not in result and "plan" in state:
        result["plan"] = state["plan"]
    if "past_steps" in result:
        current_past_steps = session_state.get("past_steps", [])
        new_steps = result.get("past_steps", [])
        session_state["past_steps"] = current_past_steps + new_steps
    return result

def wrapped_replan_step(state: dict) -> dict:
    replan_state = state.copy()
    session_state["current_step_index"] += 1
    if "plan" in replan_state and replan_state["plan"]:
        replan_state["plan"] = replan_state["plan"][1:]
    result = replan_step(replan_state)
    if "plan" in result:
        session_state["plan"] = result["plan"]
    return result

# Define the workflow
workflow = StateGraph(PlanExecute)
workflow.add_node("planner", wrapped_plan_step)
workflow.add_node("agent", wrapped_execute_step)
workflow.add_node("replan", wrapped_replan_step)
workflow.add_edge(START, "planner")
workflow.add_edge("planner", "agent")
workflow.add_edge("agent", "replan")
workflow.add_conditional_edges("replan", should_end, ["agent", END])
compiled_workflow = workflow.compile()

def run_sync_app(topic: str) -> dict:
    session_state["plan"] = []
    session_state["past_steps"] = []
    session_state["current_step_index"] = 0
    session_state["topic"] = topic

    state = {
        "input": topic,
        "plan": [],
        "past_steps": [],
        "response": ""
    }

    planner_prompt = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"Describe the qualities and domain expertise of a research assistant best suited for the following research topic:\n\n{topic}\n\nRespond only with a short paragraph."}
        ]
    ).choices[0].message.content

    current_node = START
    result = {}

    while current_node != END:
        if current_node == START:
            current_node = "planner"
            result = wrapped_plan_step(state)

        elif current_node == "planner":
            state.update(result)
            current_node = "agent"
            result = wrapped_execute_step(state)

        elif current_node == "agent":
            state.update(result)
            current_node = "replan"
            result = wrapped_replan_step(state)

        elif current_node == "replan":
            state.update(result)
            current_node = should_end(state)

    session_state["response"] = state["response"]

    query_embedding = generate_embedding(topic)
    similar_items = knn_search(query_embedding)

    return {
        "response": session_state["response"],
        "past_steps": session_state["past_steps"],
        "similar_items": similar_items,
        "docx_file": generate_docx(session_state["response"])
    }

def understand_intent(topic: str) -> str:
    return client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"Understand the intent behind the following research topic:\n\n{topic}\n\nRespond only with a short paragraph."}
        ]
    ).choices[0].message.content

class TopicRequest(BaseModel):
    topic: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/api/research")
def chat_endpoint(request: TopicRequest):
    print(f"Received topic: {request.topic}")
    if not request.topic.strip():
        return {"error": "Please provide a valid research topic."}
    result= run_sync_app(request.topic)
    print(f"Result: {result}")
    return result
app.mount("/", StaticFiles(directory="public", html=True), name="static")