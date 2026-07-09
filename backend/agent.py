from dataclasses import dataclass
from pydantic_ai import Agent, RunContext


@dataclass
class AgentDeps:
    handbook_text: str


tutor_agent = Agent(
    "google:gemini-2.5-flash",
    deps_type=AgentDeps,
)


@tutor_agent.system_prompt
def build_system_prompt(ctx: RunContext[AgentDeps]) -> str:
    base_instructions = (
        "Help tutors understand Connect Me tutoring policies, procedures, and best practices. "
        "Use the handbook text provided below to answer questions. If the information isn't in the handbook, "
        "tell the tutor you can't find it, and don't make anything up. Be helpful, clear, and refer to specific rules when answering."
    )

    if ctx.deps.handbook_text:
        return (
            f"{base_instructions}\n"
            f"--- TUTOR HANDBOOK START ---\n"
            f"{ctx.deps.handbook_text}\n"
            f"--- TUTOR HANDBOOK END ---"
        )

    return (
        f"{base_instructions}\n"
        "NOTE: The Tutor Handbook is currently unavailable. "
        "Inform the user that you cannot access the handbook at this time "
        "and suggest they try again later."
    )
