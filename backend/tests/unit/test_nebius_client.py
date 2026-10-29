"""Unit tests for nebius_client with mocked HTTP responses (zero credits consumed)."""
import json
import pytest
import httpx

from app.core.config import settings
from app.core.errors import ErrorCode, ProofPatchError
from app.schemas.api import RepairPlan
from app.services import nebius_client
from app.services.model_registry import ModelRole


def test_call_model_success_with_mock(monkeypatch):
    monkeypatch.setattr(settings, "nebius_api_key", "test-key-mock")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "nvidia/nemotron-mock")
    monkeypatch.setattr(nebius_client.model_registry, "_cached_catalog", {"nvidia/nemotron-mock"})

    mock_response = {
        "choices": [{
            "message": {"content": "{\"status\": \"ok\"}"}
        }],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5}
    }

    def mock_post(*args, **kwargs):
        assert kwargs["headers"]["Authorization"] == "Bearer test-key-mock"
        req = httpx.Request("POST", "https://api.tokenfactory.nebius.com/v1/chat/completions")
        return httpx.Response(200, json=mock_response, request=req)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    content, model_id = nebius_client.call_model("system prompt", "user prompt", role=ModelRole.REASONING)
    assert content == "{\"status\": \"ok\"}"
    assert model_id == "nvidia/nemotron-mock"


def test_call_model_rate_limit_error(monkeypatch):
    monkeypatch.setattr(settings, "nebius_api_key", "test-key-mock")
    monkeypatch.setattr(settings, "nebius_model_fast", "nvidia/nemotron-fast")
    monkeypatch.setattr(nebius_client.time, "sleep", lambda _: None)

    def mock_post(*args, **kwargs):
        req = httpx.Request("POST", "https://api.tokenfactory.nebius.com/v1/chat/completions")
        return httpx.Response(429, json={"error": "rate limit"}, request=req)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    with pytest.raises(ProofPatchError) as exc_info:
        nebius_client.call_model("sys", "user", role=ModelRole.FAST)

    assert exc_info.value.code == ErrorCode.PROVIDER_RATE_LIMIT


def test_call_model_timeout_is_reported(monkeypatch):
    monkeypatch.setattr(settings, "nebius_api_key", "test-key-mock")
    monkeypatch.setattr(settings, "nebius_model_fast", "fast-model")
    monkeypatch.setattr(nebius_client.time, "sleep", lambda _: None)
    attempts = 0

    def mock_post(self, url, **kwargs):
        nonlocal attempts
        attempts += 1
        raise httpx.ReadTimeout("simulated timeout")

    monkeypatch.setattr(httpx.Client, "post", mock_post)
    with pytest.raises(ProofPatchError) as exc_info:
        nebius_client.call_model("system prompt", "user prompt", role=ModelRole.FAST)

    assert exc_info.value.code == ErrorCode.PROVIDER_TIMEOUT
    assert attempts == nebius_client._MAX_PROVIDER_RETRIES


def test_call_model_provider_error_is_reported(monkeypatch):
    monkeypatch.setattr(settings, "nebius_api_key", "test-key-mock")
    monkeypatch.setattr(settings, "nebius_model_fast", "fast-model")
    monkeypatch.setattr(nebius_client.time, "sleep", lambda _: None)

    def mock_post(self, url, **kwargs):
        request = httpx.Request("POST", url)
        return httpx.Response(503, json={"error": "unavailable"}, request=request)

    monkeypatch.setattr(httpx.Client, "post", mock_post)
    with pytest.raises(ProofPatchError) as exc_info:
        nebius_client.call_model("system prompt", "user prompt", role=ModelRole.FAST)

    assert exc_info.value.code == ErrorCode.PROVIDER_TIMEOUT


def test_call_model_falls_back_on_unavailable_model_and_reports_actual_model(monkeypatch):
    monkeypatch.setattr(settings, "nebius_api_key", "test-key-mock")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "missing-model")
    monkeypatch.setattr(settings, "nebius_model_fast", "fast-model")
    monkeypatch.setattr(settings, "nebius_model_fallback_roles", ["fast"])
    monkeypatch.setattr(nebius_client.model_registry, "_cached_catalog", None)
    requested_models = []

    def mock_post(self, url, *, headers, json):
        requested_models.append(json["model"])
        request = httpx.Request("POST", url)
        if json["model"] == "missing-model":
            return httpx.Response(404, json={"error": "not found"}, request=request)
        return httpx.Response(
            200,
            json={
                "model": "provider-actual-fast-model",
                "choices": [{"message": {"content": "ok"}}],
            },
            request=request,
        )

    monkeypatch.setattr(httpx.Client, "post", mock_post)
    content, model_id = nebius_client.call_model("system prompt", "private source", role=ModelRole.REASONING)

    assert requested_models == ["missing-model", "fast-model"]
    assert content == "ok"
    assert model_id == "provider-actual-fast-model"


def test_call_model_rejects_empty_content(monkeypatch):
    monkeypatch.setattr(settings, "nebius_api_key", "test-key-mock")
    monkeypatch.setattr(settings, "nebius_model_fast", "fast-model")

    def mock_post(self, url, **kwargs):
        request = httpx.Request("POST", url)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": ""}}]},
            request=request,
        )

    monkeypatch.setattr(httpx.Client, "post", mock_post)
    with pytest.raises(ProofPatchError) as exc_info:
        nebius_client.call_model("system prompt", "user prompt", role=ModelRole.FAST)

    assert exc_info.value.code == ErrorCode.MODEL_OUTPUT_INVALID


def test_generate_plan_schema_validation(monkeypatch):
    monkeypatch.setattr(settings, "nebius_api_key", "test-key-mock")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "nvidia/nemotron-mock")
    monkeypatch.setattr(nebius_client.model_registry, "_cached_catalog", {"nvidia/nemotron-mock"})

    valid_plan = {
        "summary": "Fix calculation bug",
        "diagnosis_hypothesis": "Off by logic error in negation",
        "target_files": ["src/calc.py"],
        "planned_changes": [
            {"file": "src/calc.py", "change": "return -n if n < 0 else n", "reason": "handle negative"}
        ],
        "risks": ["minor regression risk"],
        "verification_strategy": ["run pytest"]
    }

    def mock_post(*args, **kwargs):
        req = httpx.Request("POST", "https://api.tokenfactory.nebius.com/v1/chat/completions")
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(valid_plan)}}]}, request=req)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    dummy_context = {
        "repo_summary": {"python_files": 1, "test_files": 1, "included_in_context": 1},
        "relevant_files": [{"rel_path": "src/calc.py", "content": "def f(): pass", "truncated": False}]
    }

    plan, model_id = nebius_client.generate_plan(dummy_context, "Bug in calculation")
    assert isinstance(plan, RepairPlan)
    assert plan.target_files == ["src/calc.py"]
    assert model_id == "nvidia/nemotron-mock"


def test_generate_patch_normalizes_backslash_paths_and_includes_content_in_prompt(monkeypatch):
    captured_prompts = []

    def mock_call_model(system_prompt, user_prompt, role=None, job_id=None):
        captured_prompts.append((system_prompt, user_prompt))
        proposal_json = json.dumps({
            "summary": "Fix calc function",
            "patch_format": "unified_diff",
            "patch": "--- a/src/calc.py\n+++ b/src/calc.py\n@@ -1,2 +1,2 @@\n-def f(): pass\n+def f(): return 42\n",
            "files_expected_to_change": ["src/calc.py"]
        })
        return proposal_json, "mock-model"

    monkeypatch.setattr(nebius_client, "call_model", mock_call_model)

    # Context uses Windows backslash paths
    context = {
        "relevant_files": [
            {"rel_path": "src\\calc.py", "content": "def calculate(): return 123", "truncated": False}
        ]
    }
    # Plan uses POSIX forward-slash paths
    plan = RepairPlan(
        summary="Fix calc",
        diagnosis_hypothesis="calc returns wrong value",
        target_files=["src/calc.py"],
        planned_changes=[
            {"file": "src/calc.py", "change": "return 42", "reason": "correct"}
        ],
        risks=[],
        verification_strategy=["pytest"]
    )

    proposal, model_id = nebius_client.generate_patch(context, plan)
    assert proposal.summary == "Fix calc function"
    assert len(captured_prompts) == 1
    sys_prompt, user_prompt = captured_prompts[0]

    # Verify that the file content was NOT dropped from the prompt due to backslashes
    assert "=== FILE: src/calc.py ===" in user_prompt
    assert "def calculate(): return 123" in user_prompt


def test_generate_patch_empty_context_raises():
    context = {
        "relevant_files": [
            {"rel_path": "src/other.py", "content": "def other(): pass", "truncated": False}
        ]
    }
    plan = RepairPlan(
        summary="Fix calc",
        diagnosis_hypothesis="target missing",
        target_files=["src/nonexistent.py"],
        planned_changes=[],
        risks=[],
        verification_strategy=["pytest"]
    )

    with pytest.raises(ProofPatchError) as exc_info:
        nebius_client.generate_patch(context, plan)

    assert exc_info.value.code == ErrorCode.MODEL_OUTPUT_INVALID
    assert "No source files matched the planned target files" in exc_info.value.message


def test_revise_patch_empty_context_raises():
    context = {
        "relevant_files": [
            {"rel_path": "src/other.py", "content": "def other(): pass", "truncated": False}
        ]
    }
    plan = RepairPlan(
        summary="Fix calc",
        diagnosis_hypothesis="target missing",
        target_files=["src/nonexistent.py"],
        planned_changes=[],
        risks=[],
        verification_strategy=["pytest"]
    )

    with pytest.raises(ProofPatchError) as exc_info:
        nebius_client.revise_patch(
            original_patch="--- a/src/nonexistent.py\n+++ b/src/nonexistent.py\n",
            test_stdout="FAILED",
            test_stderr="",
            context=context,
            plan=plan,
        )

    assert exc_info.value.code == ErrorCode.MODEL_OUTPUT_INVALID
    assert "No source files matched the planned target files" in exc_info.value.message


def test_format_with_line_numbers():
    content = "line one\nline two\nline three"
    numbered = nebius_client._format_with_line_numbers(content)
    lines = numbered.split("\n")
    assert len(lines) == 3
    assert lines[0].strip() == "1 | line one"
    assert lines[1].strip() == "2 | line two"
    assert lines[2].strip() == "3 | line three"


def test_revise_patch_on_apply_error_success(monkeypatch):
    captured_prompts = []

    def mock_call_model(sys_prompt, user_prompt, role, job_id=None):
        captured_prompts.append((sys_prompt, user_prompt))
        return (
            json.dumps({
                "summary": "Fix hunk context lines",
                "patch_format": "unified_diff",
                "patch": "--- a/src/calc.py\n+++ b/src/calc.py\n@@ -1,2 +1,2 @@\n-def calc(): return 1\n+def calc(): return 2\n",
                "files_expected_to_change": ["src/calc.py"],
                "notes": ["Adjusted context line to match actual line 1"]
            }),
            "mock-nvidia-nemotron"
        )

    monkeypatch.setattr(nebius_client, "call_model", mock_call_model)

    context = {
        "relevant_files": [
            {"rel_path": "src/calc.py", "content": "def calc(): return 1\n", "truncated": False}
        ]
    }
    plan = RepairPlan(
        summary="Fix calc return",
        diagnosis_hypothesis="calc returns 1 instead of 2",
        target_files=["src/calc.py"],
        planned_changes=[],
        risks=[],
        verification_strategy=["pytest"]
    )

    proposal, model_id = nebius_client.revise_patch_on_apply_error(
        original_patch="--- a/src/calc.py\n+++ b/src/calc.py\n@@ -1,2 +1,2 @@\n-wrong context\n+def calc(): return 2\n",
        apply_error="Context mismatch in src/calc.py: hunk at line 1 does not match original file content.",
        context=context,
        plan=plan,
    )

    assert proposal.summary == "Fix hunk context lines"
    assert model_id == "mock-nvidia-nemotron"
    assert len(captured_prompts) == 1
    sys_prompt, user_prompt = captured_prompts[0]
    assert "PATCH APPLICATION ERROR:" in user_prompt
    assert "Context mismatch in src/calc.py" in user_prompt
    assert "REAL SOURCE FILES (WITH 1-BASED LINE NUMBERS):" in user_prompt
    assert "1 | def calc(): return 1" in user_prompt


def test_revise_patch_on_apply_error_empty_context_raises():
    context = {
        "relevant_files": [
            {"rel_path": "src/other.py", "content": "def other(): pass", "truncated": False}
        ]
    }
    plan = RepairPlan(
        summary="Fix calc",
        diagnosis_hypothesis="target missing",
        target_files=["src/nonexistent.py"],
        planned_changes=[],
        risks=[],
        verification_strategy=["pytest"]
    )

    with pytest.raises(ProofPatchError) as exc_info:
        nebius_client.revise_patch_on_apply_error(
            original_patch="--- a/src/nonexistent.py\n+++ b/src/nonexistent.py\n",
            apply_error="File not found",
            context=context,
            plan=plan,
        )

    assert exc_info.value.code == ErrorCode.MODEL_OUTPUT_INVALID
    assert "No source files matched planned targets" in exc_info.value.message

