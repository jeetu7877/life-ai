from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.vault import SecureVaultItem
from app.schemas.vault import VaultItemCreate, VaultItemResponse, VaultItemRevealResponse
from app.security.dependencies import get_optional_user
from app.services.vault_service import vault_service

router = APIRouter(prefix="/vault", tags=["Secure Vault"])

@router.get("", response_model=List[VaultItemResponse])
def get_vault_items(db: Session = Depends(get_db), user: User = Depends(get_optional_user)):
    """Return all encrypted items masked with safety hints."""
    return vault_service.get_user_items_masked(db, user.id)

@router.post("", response_model=VaultItemResponse)
def store_vault_item(
    item_in: VaultItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Encrypt and store a sensitive identifier."""
    item = vault_service.store_item(
        db=db,
        user_id=user.id,
        key_name=item_in.key_name,
        item_type=item_in.item_type,
        raw_value=item_in.raw_value,
        notes=item_in.notes
    )
    return item

@router.post("/{item_id}/reveal", response_model=VaultItemRevealResponse)
def reveal_vault_item(
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Authorized decryption of a sensitive item."""
    decrypted = vault_service.reveal_item(db, user.id, item_id)
    if decrypted is None:
        raise HTTPException(status_code=404, detail="Item not found or unauthorized")

    item = db.query(SecureVaultItem).filter(SecureVaultItem.id == item_id).first()
    return VaultItemRevealResponse(
        id=item.id,
        key_name=item.key_name,
        item_type=item.item_type,
        decrypted_value=decrypted,
        notes=item.notes
    )

@router.delete("/{item_id}")
def delete_vault_item(
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    item = db.query(SecureVaultItem).filter(
        SecureVaultItem.id == item_id,
        SecureVaultItem.user_id == user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted", "id": item_id}
