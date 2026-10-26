"""Unit tests for ModelRegistry: role selection, catalog checking, and safe fallback."""
import pytest

from app.core.config import settings
from app.services.model_registry import ModelRegistry, ModelRole


@pytest.fixture
def registry():
    return ModelRegistry()


def test_get_configured_model_roles(registry, monkeypatch):
    monkeypatch.setattr(settings, "nebius_model_fast", "nvidia/Nemotron-3_5-Lightning")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "nvidia/nemotron-3-super-120b-a12b")
    monkeypatch.setattr(settings, "nebius_model_advanced", "nvidia/Nemotron-3-Ultra-550b-a55b")

    assert registry.get_configured_model(ModelRole.FAST) == "nvidia/Nemotron-3_5-Lightning"
    assert registry.get_configured_model(ModelRole.REASONING) == "nvidia/nemotron-3-super-120b-a12b"
    assert registry.get_configured_model(ModelRole.ADVANCED) == "nvidia/Nemotron-3-Ultra-550b-a55b"


def test_select_model_exact_match(registry, monkeypatch):
    catalog = {
        "nvidia/Nemotron-3_5-Lightning",
        "nvidia/nemotron-3-super-120b-a12b",
        "nvidia/Nemotron-3-Ultra-550b-a55b",
    }
    monkeypatch.setattr(settings, "nebius_model_fast", "nvidia/Nemotron-3_5-Lightning")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "nvidia/nemotron-3-super-120b-a12b")
    monkeypatch.setattr(settings, "nebius_model_advanced", "nvidia/Nemotron-3-Ultra-550b-a55b")

    model_id, resolved_role, is_fallback = registry.select_model(ModelRole.REASONING, available_models=catalog)
    assert model_id == "nvidia/nemotron-3-super-120b-a12b"
    assert resolved_role == ModelRole.REASONING
    assert is_fallback is False


def test_select_model_safe_fallback_when_unavailable(registry, monkeypatch):
    # The configured fallback is reasoning, then fast; advanced is never implicit.
    catalog = {
        "nvidia/Nemotron-3_5-Lightning",
    }
    monkeypatch.setattr(settings, "nebius_model_fast", "nvidia/Nemotron-3_5-Lightning")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "nvidia/nemotron-3-super-missing")
    monkeypatch.setattr(settings, "nebius_model_advanced", "nvidia/Nemotron-3-Ultra-550b-a55b")

    model_id, resolved_role, is_fallback = registry.select_model(ModelRole.REASONING, available_models=catalog)
    assert model_id == "nvidia/Nemotron-3_5-Lightning"
    assert resolved_role == ModelRole.FAST
    assert is_fallback is True


def test_fallback_roles_are_configurable_and_never_implicitly_advanced(registry, monkeypatch):
    monkeypatch.setattr(settings, "nebius_model_fast", "fast-model")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "reasoning-model")
    monkeypatch.setattr(settings, "nebius_model_advanced", "advanced-model")
    monkeypatch.setattr(settings, "nebius_model_fallback_roles", ["advanced", "fast"])

    model_id, resolved_role, is_fallback = registry.select_model(
        ModelRole.REASONING,
        available_models={"fast-model", "advanced-model"},
    )

    assert (model_id, resolved_role, is_fallback) == ("fast-model", ModelRole.FAST, True)


def test_legacy_single_model_backward_compatibility(registry, monkeypatch):
    monkeypatch.setattr(settings, "nebius_model_fast", "")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "")
    monkeypatch.setattr(settings, "nebius_model_advanced", "")
    monkeypatch.setattr(settings, "nebius_model", "nvidia/Nemotron-legacy")

    model_id, resolved_role, is_fallback = registry.select_model(ModelRole.REASONING)
    assert model_id == "nvidia/Nemotron-legacy"
    assert is_fallback is False


def test_catalog_request_uses_auth_and_validates_ids(registry, monkeypatch):
    import httpx

    monkeypatch.setattr(settings, "nebius_api_key", "unit-test-secret")
    monkeypatch.setattr(settings, "nebius_base_url", "https://tokenfactory.example/v1")

    def mock_get(self, url, headers):
        assert url == "https://tokenfactory.example/v1/models"
        assert headers["Authorization"] == "Bearer unit-test-secret"
        request = httpx.Request("GET", url)
        return httpx.Response(200, json={"data": [{"id": "model-a"}]}, request=request)

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    assert registry.fetch_available_models() == ["model-a"]
    assert registry.verify_model_in_catalog("model-a")
    assert not registry.verify_model_in_catalog("unknown-model")


def test_select_model_fails_when_no_configured_model_is_in_catalog(registry, monkeypatch):
    monkeypatch.setattr(settings, "nebius_model_fast", "fast")
    monkeypatch.setattr(settings, "nebius_model_reasoning", "reasoning")
    monkeypatch.setattr(settings, "nebius_model_advanced", "advanced")

    from app.core.errors import ProofPatchError

    with pytest.raises(ProofPatchError):
        registry.select_model(ModelRole.REASONING, available_models={"unrelated"})
