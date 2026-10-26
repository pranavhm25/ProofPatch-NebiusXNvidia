"""Central model configuration, catalog verification, and role selection."""
from __future__ import annotations

import logging
from enum import Enum
from typing import Dict, Optional, Set, Tuple

import httpx

from app.core.config import settings
from app.core.errors import ErrorCode, ProofPatchError

logger = logging.getLogger(__name__)


class ModelRole(str, Enum):
    FAST = "fast"
    REASONING = "reasoning"
    ADVANCED = "advanced"


class ModelRegistry:
    """Resolves configured model roles and records a verified Token Factory catalog."""

    def __init__(self) -> None:
        self._cached_catalog: Optional[Set[str]] = None

    def get_configured_model(self, role: ModelRole) -> str:
        configured: Dict[ModelRole, str] = {
            ModelRole.FAST: settings.nebius_model_fast,
            ModelRole.REASONING: settings.nebius_model_reasoning,
            ModelRole.ADVANCED: settings.nebius_model_advanced,
        }
        return configured[role] or settings.nebius_model

    def fetch_available_models(self, client: Optional[httpx.Client] = None) -> list[str]:
        """Fetch model IDs from the authenticated Token Factory /models endpoint."""
        if not settings.nebius_api_key:
            raise ProofPatchError(
                code=ErrorCode.PROVIDER_AUTH_ERROR,
                message="NEBIUS_API_KEY is not configured.",
                http_status=503,
            )

        url = f"{settings.nebius_base_url.rstrip('/')}/models"
        headers = {"Authorization": f"Bearer {settings.nebius_api_key}"}
        try:
            if client is not None:
                response = client.get(url, headers=headers)
            else:
                with httpx.Client(timeout=settings.provider_timeout_seconds) as default_client:
                    response = default_client.get(url, headers=headers)
        except httpx.TimeoutException as exc:
            logger.warning("Model catalog request failed: outcome=timeout")
            raise ProofPatchError(
                code=ErrorCode.PROVIDER_TIMEOUT,
                message="The model catalog request timed out.",
                http_status=504,
            ) from exc
        except httpx.RequestError as exc:
            logger.warning("Model catalog request failed: outcome=network_error")
            raise ProofPatchError(
                code=ErrorCode.PROVIDER_TIMEOUT,
                message="Could not reach the model catalog.",
                http_status=503,
            ) from exc

        if response.status_code in (401, 403):
            logger.warning("Model catalog request failed: outcome=authentication_error status=%d", response.status_code)
            raise ProofPatchError(
                code=ErrorCode.PROVIDER_AUTH_ERROR,
                message="Authentication with the model provider failed.",
                http_status=503,
            )
        if not response.is_success:
            logger.warning("Model catalog request failed: outcome=http_error status=%d", response.status_code)
            raise ProofPatchError(
                code=ErrorCode.PROVIDER_TIMEOUT,
                message="The model provider could not return its model catalog.",
                http_status=502,
            )

        try:
            data = response.json()
            models = data["data"]
            if not isinstance(models, list):
                raise ValueError("catalog data is not a list")
            model_ids = {model["id"] for model in models if isinstance(model, dict) and isinstance(model.get("id"), str)}
        except (ValueError, KeyError, TypeError):
            logger.warning("Model catalog request failed: outcome=malformed_response")
            raise ProofPatchError(
                code=ErrorCode.MODEL_OUTPUT_INVALID,
                message="The model provider returned a malformed model catalog.",
                http_status=502,
            )

        self._cached_catalog = model_ids
        logger.info("Model catalog request completed: outcome=success model_count=%d", len(model_ids))
        return sorted(model_ids)

    def verify_model_in_catalog(self, model_id: str, available_models: Optional[Set[str]] = None) -> bool:
        """Check a configured ID against an explicit or recently fetched catalog."""
        catalog = available_models if available_models is not None else self._cached_catalog
        return bool(model_id) and (catalog is None or model_id in catalog)

    def select_model(
        self,
        role: ModelRole = ModelRole.FAST,
        available_models: Optional[Set[str]] = None,
        exclude: Optional[Set[str]] = None,
    ) -> Tuple[str, ModelRole, bool]:
        """Return (model ID, resolved role, whether a fallback was selected)."""
        catalog = available_models if available_models is not None else self._cached_catalog
        excluded = exclude or set()
        candidates = [role]
        for role_name in settings.nebius_model_fallback_roles:
            try:
                fallback_role = ModelRole(role_name)
            except ValueError:
                logger.warning("Ignoring invalid model fallback role: %s", role_name)
                continue
            if fallback_role != ModelRole.ADVANCED and fallback_role not in candidates:
                candidates.append(fallback_role)

        for candidate_role in candidates:
            model_id = self.get_configured_model(candidate_role)
            if not model_id or model_id in excluded:
                continue
            if catalog is not None and model_id not in catalog:
                continue
            is_fallback = candidate_role != role
            logger.info(
                "Model selected: requested_role=%s resolved_role=%s model_id=%s fallback=%s verification=%s",
                role.value,
                candidate_role.value,
                model_id,
                is_fallback,
                "catalog" if catalog is not None else "inference_pending",
            )
            return model_id, candidate_role, is_fallback

        raise ProofPatchError(
            code=ErrorCode.MODEL_UNAVAILABLE,
            message=f"No configured model is available for role '{role.value}' or its allowed fallbacks.",
            http_status=503,
        )


model_registry = ModelRegistry()
