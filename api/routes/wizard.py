from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()


class WizardStepBody(BaseModel):
    step: int
    data: dict = {}


class WizardCompleteBody(BaseModel):
    config: dict


@router.get("/status")
async def get_wizard_status(user=Depends(get_current_user)):
    state = await db.get_wizard_state()
    return {
        "completed": state["completed"],
        "current_step": state["current_step"],
        "data": state["data"],
    }


@router.put("/step")
async def update_wizard_step(body: WizardStepBody, user=Depends(get_current_user)):
    await db.set_wizard_state(current_step=body.step, data=body.data)
    return {"status": "ok"}


@router.post("/complete")
async def complete_wizard(body: WizardCompleteBody, user=Depends(get_current_user)):
    await db.set_config_bulk(body.config)
    await db.set_wizard_state(completed=True)
    return {
        "status": "ok",
        "message": "Wizard complete",
        "config_count": len(body.config),
        "providers_configured": list(body.config.keys()),
    }


@router.post("/reset")
async def reset_wizard(user=Depends(get_current_user)):
    await db.set_wizard_state(completed=False, current_step=1, data={})
    return {"status": "ok", "message": "Wizard reset"}