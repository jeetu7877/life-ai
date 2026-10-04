import os
import time
import secrets
import hashlib
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Tuple, Optional, Dict
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User

logger = logging.getLogger("life.email_service")

# In-memory rate limiting tracker: {email: last_request_epoch}
_resend_rate_limits: Dict[str, float] = {}
RATE_LIMIT_COOLDOWN_SECONDS = 60

class EmailVerificationService:
    """
    Production-grade Email Account Verification & Recovery Service.
    - Generates cryptographically secure, url-safe tokens.
    - Stores strictly one-way SHA-256 hashes in database.
    - Enforces 24-hour expiration and 60-second rate limiting.
    - Delivers via SMTP if configured; otherwise logs clean verification links for local/staging runs.
    """

    def generate_verification_token(self) -> Tuple[str, str, datetime]:
        """
        Returns (raw_token, token_hash, expires_at).
        Never save raw_token to the database.
        """
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = datetime.utcnow() + timedelta(hours=24)
        return raw_token, token_hash, expires_at

    def check_resend_rate_limit(self, email: str) -> Tuple[bool, int]:
        """
        Returns (allowed, seconds_remaining).
        """
        now = time.time()
        last_req = _resend_rate_limits.get(email.lower(), 0.0)
        elapsed = now - last_req
        if elapsed < RATE_LIMIT_COOLDOWN_SECONDS:
            return False, int(RATE_LIMIT_COOLDOWN_SECONDS - elapsed)
        _resend_rate_limits[email.lower()] = now
        return True, 0

    def send_verification_email(
        self,
        to_email: str,
        username: str,
        raw_token: str,
        frontend_base_url: Optional[str] = None
    ) -> bool:
        """
        Formats and delivers account verification email.
        """
        base_url = frontend_base_url or os.environ.get("FRONTEND_URL") or "https://life-ai-daoh.onrender.com"
        verification_link = f"{base_url.rstrip('/')}/verify-email?token={raw_token}"

        subject = "Verify your Life AI Account"
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #05070B; color: #F8FAFC; margin: 0; padding: 20px; }}
            .card {{ max-width: 520px; margin: 0 auto; background-color: #101722; border: 1px solid #202B3D; border-radius: 16px; padding: 32px; }}
            .logo {{ font-size: 20px; font-weight: bold; color: #00D9FF; margin-bottom: 24px; }}
            .btn {{ display: inline-block; background: linear-gradient(135deg, #00A8FF, #8B5CF6); color: #ffffff !important; padding: 12px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 24px 0; }}
            .footer {{ font-size: 11px; color: #64748B; margin-top: 24px; border-top: 1px solid #202B3D; padding-top: 16px; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">⚡ Life AI — Personal Operating System</div>
            <h2>Verify Your Email, {username}!</h2>
            <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
              Welcome to Life AI. Please click the button below to verify your email address and activate your persistent personal memory, document brain, and wake-word companion.
            </p>
            <div style="text-align: center;">
              <a href="{verification_link}" class="btn">Verify Email Address</a>
            </div>
            <p style="color: #64748B; font-size: 12px;">
              Link expires in 24 hours. If the button doesn't work, copy and paste this URL into your browser:<br>
              <a href="{verification_link}" style="color: #00D9FF; word-break: break-all;">{verification_link}</a>
            </p>
            <div class="footer">
              If you didn't create an account with Life AI, you can safely ignore this email.
            </div>
          </div>
        </body>
        </html>
        """

        # 1. Attempt SMTP delivery if configured in environment
        smtp_host = os.environ.get("SMTP_HOST") or getattr(settings, "SMTP_HOST", None)
        smtp_port = int(os.environ.get("SMTP_PORT", 587))
        smtp_user = os.environ.get("SMTP_USER") or getattr(settings, "SMTP_USER", None)
        smtp_pass = os.environ.get("SMTP_PASS") or getattr(settings, "SMTP_PASS", None)
        from_email = os.environ.get("SMTP_FROM", "no-reply@life-ai.com")

        if smtp_host and smtp_user and smtp_pass:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = from_email
                msg["To"] = to_email
                msg.attach(MIMEText(html_body, "html"))

                with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(from_email, [to_email], msg.as_string())
                logger.info(f"[AUTH_EMAIL] Verification email sent to {to_email} via SMTP.")
                return True
            except Exception as e:
                logger.warning(f"[AUTH_EMAIL] SMTP delivery failed: {e}. Falling back to system log.")

        # 2. Local / Staging fallback: Log link prominently for frictionless verification
        logger.info(f"[AUTH_EMAIL] To: {to_email} | Link: {verification_link}")
        print(f"\n======================================================\n[AUTH_EMAIL] VERIFICATION LINK FOR {to_email}:\n{verification_link}\n======================================================\n")
        return True

    def verify_token(self, raw_token: str, db: Session) -> Tuple[bool, str, Optional[User]]:
        """
        Validates token against stored hash and expiry.
        Returns (success, message, user).
        """
        if not raw_token or not raw_token.strip():
            return False, "Verification token is required", None

        token_hash = hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

        user = db.query(User).filter(User.verification_token_hash == token_hash).first()
        if not user:
            return False, "Invalid verification link or token has already been used", None

        if user.verification_token_expires_at and user.verification_token_expires_at < datetime.utcnow():
            return False, "Verification link has expired. Please request a new one.", user

        # Mark user verified
        user.is_verified = True
        user.verification_token_hash = None
        user.verification_token_expires_at = None
        db.commit()
        db.refresh(user)

        logger.info(f"[AUTH_EMAIL] User {user.username} ({user.email}) successfully verified.")
        return True, "Email verified successfully.", user


email_service = EmailVerificationService()
