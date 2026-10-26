"""Optional live Token Factory checks; unit tests use mocked HTTP responses."""
import pytest

from app.core.config import settings
from app.services import nebius_client
from app.services.model_registry import ModelRole, model_registry

pytestmark = pytest.mark.skipif(
    not settings.nebius_api_key,
    reason="NEBIUS_API_KEY is not configured; skipping live integration tests.",
)


def test_live_catalog_contains_each_configured_model():
    available_models = set(model_registry.fetch_available_models())
    configured_models = {
        model_registry.get_configured_model(role)
        for role in ModelRole
        if model_registry.get_configured_model(role)
    }
    assert configured_models, "No Nebius model role is configured."
    assert configured_models <= available_models, (
        "Configured model IDs missing from the authenticated Token Factory catalog: "
        f"{sorted(configured_models - available_models)}"
    )


def test_live_inference_uses_configured_reasoning_model():
    configured_model = model_registry.get_configured_model(ModelRole.REASONING)
    if not configured_model:
        pytest.skip("No reasoning model configured for the live inference check.")

    content, model_id_used = nebius_client.call_model(
        system_prompt="Respond concisely.",
        user_prompt="Reply with the exact text PROOFPATCH_LIVE_OK.",
        role=ModelRole.REASONING,
    )

    assert content.strip()
    assert model_id_used == configured_model, (
        f"Inference used {model_id_used!r}, not configured reasoning model {configured_model!r}."
    )
