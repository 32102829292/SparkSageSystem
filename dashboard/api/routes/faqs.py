from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()


class FAQCreate(BaseModel):
    question: str
    answer: str
    match_keywords: str


@router.get("")
async def list_faqs(user=Depends(get_current_user)):
    return await db.get_faqs()


@router.post("")
async def create_faq(body: FAQCreate, user=Depends(get_current_user)):
    faq_id = await db.create_faq(body.question, body.answer, body.match_keywords)
    return {"id": faq_id, **body.dict()}


@router.delete("/{faq_id}")
async def delete_faq(faq_id: int, user=Depends(get_current_user)):
    await db.delete_faq(faq_id)
    return {"deleted": faq_id}