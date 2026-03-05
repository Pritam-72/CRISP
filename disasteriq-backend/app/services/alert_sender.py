"""
Twilio SMS/WhatsApp alert sender with simulation fallback.
"""
import logging
from app.config import settings
from app.models import District

logger = logging.getLogger(__name__)

SEVERITY_EMOJI = {
    "low": "🟡",
    "medium": "🟠",
    "high": "🔴",
    "critical": "🚨",
}


def _simulate_send(district: District, severity: str, message: str, channel: str) -> dict:
    """Log the alert instead of sending — used in demo mode."""
    emoji = SEVERITY_EMOJI.get(severity, "⚠️")
    formatted = f"[SIMULATED {channel.upper()}] {emoji} DISASTERIQ ALERT — {district.name}: {message}"
    logger.warning(formatted)
    print(formatted)
    return {
        "mode": "simulated",
        "channel": channel,
        "recipient": f"+91-XXXXXXXXXX ({district.name} District Officer)",
        "message": message,
    }


def send_alert(district: District, severity: str, message: str, channel: str = "dashboard") -> dict:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        return _simulate_send(district, severity, message, channel)

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        emoji = SEVERITY_EMOJI.get(severity, "⚠️")
        body = f"{emoji} DisasterIQ Alert — {severity.upper()}\n{district.name}, {district.state}\n\n{message}\n\n— Sent by DisasterIQ NDMA System"

        if channel == "whatsapp":
            from_number = f"whatsapp:{settings.TWILIO_FROM_NUMBER}"
            to_number = f"whatsapp:+919999999999"  # placeholder
        else:
            from_number = settings.TWILIO_FROM_NUMBER
            to_number = "+919999999999"  # placeholder

        msg = client.messages.create(body=body, from_=from_number, to=to_number)
        return {"mode": "sent", "sid": msg.sid, "channel": channel, "status": msg.status}
    except Exception as e:
        logger.error(f"Twilio failed: {e}")
        return _simulate_send(district, severity, message, channel)
