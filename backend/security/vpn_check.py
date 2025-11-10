from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

from ..settings import get_settings


LOGGER = logging.getLogger("security.vpn")


@dataclass
class VpnAssessment:
    ip: str
    is_vpn: bool
    is_proxy: bool
    country: str | None
    region: str | None
    source: str
    raw: dict[str, Any] | None = None

    @property
    def suspicious(self) -> bool:
        return self.is_vpn or self.is_proxy


class VpnChecker:
    """Lightweight IP reputation utility. Falls back to offline heuristics when API calls fail."""

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.vpn_api_key
        self.provider_url = settings.vpn_provider_url.rstrip("/")

    async def assess(self, ip_address: str) -> VpnAssessment:
        if not ip_address:
            return VpnAssessment(ip="unknown", is_vpn=False, is_proxy=False, country=None, region=None, source="unknown")

        if not self.api_key:
            LOGGER.warning("VPN_API_KEY not configured; defaulting to allow.")
            return VpnAssessment(ip=ip_address, is_vpn=False, is_proxy=False, country=None, region=None, source="disabled")

        url = f"{self.provider_url}/{ip_address}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
        except Exception as exc:  # pragma: no cover - network dependent
            LOGGER.error("VPN lookup failed: %s", exc)
            return VpnAssessment(ip=ip_address, is_vpn=False, is_proxy=False, country=None, region=None, source="error")

        country = (data.get("country") or {}).get("code") if isinstance(data.get("country"), dict) else data.get("country")
        region = (data.get("region") or {}).get("name") if isinstance(data.get("region"), dict) else data.get("region")
        privacy = data.get("privacy") or {}
        return VpnAssessment(
            ip=ip_address,
            is_vpn=bool(privacy.get("vpn") or privacy.get("tor")),
            is_proxy=bool(privacy.get("proxy")),
            country=country,
            region=region,
            source="ipinfo",
            raw=data,
        )


vpn_checker = VpnChecker()
