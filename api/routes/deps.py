from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
import config
from api import auth_utils  # your jwt file

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        if not config.WIZARD_COMPLETED:
            return {"username": "admin_setup"}
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = auth_utils.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {"username": payload.get("sub")}