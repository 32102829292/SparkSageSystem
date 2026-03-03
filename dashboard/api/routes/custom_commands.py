from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db as database

router = APIRouter()


class CustomCommandCreate(BaseModel):
    name: str
    response: str
    description: str = "A custom command"
    guild_id: str = "global"


class CustomCommandUpdate(BaseModel):
    response: str
    description: str


@router.get("")
async def list_custom_commands(user=Depends(get_current_user)):
    return await database.get_custom_commands()


@router.post("")
async def create_custom_command(body: CustomCommandCreate, user=Depends(get_current_user)):
    try:
        cmd_id = await database.create_custom_command(
            name=body.name,
            response=body.response,
            description=body.description,
            guild_id=body.guild_id,
        )
        return {"id": cmd_id, **body.dict()}
    except Exception:
        raise HTTPException(status_code=400, detail="Command already exists with that name.")


@router.put("/{command_id}")
async def update_custom_command(command_id: int, body: CustomCommandUpdate, user=Depends(get_current_user)):
    await database.update_custom_command(command_id, body.response, body.description)
    return {"id": command_id, **body.dict()}


@router.patch("/{command_id}/toggle")
async def toggle_custom_command(command_id: int, enabled: bool, user=Depends(get_current_user)):
    await database.toggle_custom_command(command_id, enabled)
    return {"id": command_id, "enabled": enabled}


@router.delete("/{command_id}")
async def delete_custom_command(command_id: int, user=Depends(get_current_user)):
    await database.delete_custom_command(command_id)
    return {"deleted": command_id}