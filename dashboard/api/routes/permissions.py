from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()


class PermissionBody(BaseModel):
    command_name: str
    guild_id: str
    role_id: str


@router.get("")
async def list_permissions(user=Depends(get_current_user)):
    return await db.get_permissions()


@router.post("")
async def add_permission(body: PermissionBody, user=Depends(get_current_user)):
    await db.add_permission(body.command_name, body.guild_id, body.role_id)
    return body.dict()


@router.delete("")
async def remove_permission(body: PermissionBody, user=Depends(get_current_user)):
    await db.remove_permission(body.command_name, body.guild_id, body.role_id)
    return {"deleted": True}