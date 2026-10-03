from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.vault import SecureVaultItem
from app.models.audit import AuditLog
from app.security.crypto import encrypt_value, decrypt_value, generate_masked_hint

class VaultService:
    def store_item(
        self,
        db: Session,
        user_id: str,
        key_name: str,
        item_type: str,
        raw_value: str,
        notes: Optional[str] = None
    ) -> SecureVaultItem:
        encrypted = encrypt_value(raw_value)
        masked = generate_masked_hint(item_type, raw_value)
        
        item = SecureVaultItem(
            user_id=user_id,
            key_name=key_name,
            item_type=item_type,
            encrypted_value=encrypted,
            masked_hint=masked,
            notes=notes
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        
        # Log action
        self._audit(db, user_id, "VAULT_CREATE", f"Created secure item: {key_name}")
        return item

    def get_user_items_masked(self, db: Session, user_id: str) -> List[SecureVaultItem]:
        """Return masked representations safe for frontend list view."""
        return db.query(SecureVaultItem).filter(SecureVaultItem.user_id == user_id).all()

    def reveal_item(self, db: Session, user_id: str, item_id: str) -> Optional[str]:
        """Authorized decryption of a sensitive item."""
        item = db.query(SecureVaultItem).filter(
            SecureVaultItem.id == item_id,
            SecureVaultItem.user_id == user_id
        ).first()
        if not item:
            return None
        
        decrypted = decrypt_value(item.encrypted_value)
        self._audit(db, user_id, "VAULT_REVEAL", f"Decrypted sensitive item: {item.key_name}")
        return decrypted

    def query_by_type_or_name(self, db: Session, user_id: str, query: str) -> Optional[str]:
        """Find value for agent when specifically asked by authorized user (e.g. 'What is my PAN number?')."""
        q = query.lower()
        item = None
        if "pan" in q:
            item = db.query(SecureVaultItem).filter(
                SecureVaultItem.user_id == user_id,
                SecureVaultItem.item_type == "pan"
            ).first()
        elif "aadhaar" in q or "aadhar" in q:
            item = db.query(SecureVaultItem).filter(
                SecureVaultItem.user_id == user_id,
                SecureVaultItem.item_type == "aadhaar"
            ).first()
        elif "passport" in q:
            item = db.query(SecureVaultItem).filter(
                SecureVaultItem.user_id == user_id,
                SecureVaultItem.item_type == "passport"
            ).first()
            
        if item:
            self._audit(db, user_id, "AGENT_VAULT_QUERY", f"Agent queried: {item.key_name}")
            return decrypt_value(item.encrypted_value)
        return None

    def _audit(self, db: Session, user_id: str, action: str, details: str):
        log = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            status="SUCCESS"
        )
        db.add(log)
        db.commit()

vault_service = VaultService()
