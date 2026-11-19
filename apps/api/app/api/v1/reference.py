from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_context, get_data_db
from app.db.models import City, Province
from app.domain import vocab
from app.services import properties as svc
from app.services.auth import AuthContext

router = APIRouter(tags=["reference"])


class VocabItem(BaseModel):
    key: str
    fa: str
    en: str


class CityOut(BaseModel):
    id: int
    name: str
    province_id: int
    province_name: str


class ProvinceOut(BaseModel):
    id: int
    name: str


@router.get("/vocab", response_model=dict[str, list[VocabItem]])
def get_vocab() -> dict[str, list[VocabItem]]:
    """All controlled lists with Persian and English labels (public, static)."""
    return {
        name: [VocabItem(key=i.key, fa=i.fa, en=i.en) for i in items]
        for name, items in vocab.ALL.items()
    }


@router.get("/geo/provinces", response_model=list[ProvinceOut])
def list_provinces(
    _: AuthContext = Depends(get_context), db: Session = Depends(get_data_db)
) -> list[ProvinceOut]:
    from sqlalchemy import select

    from app.db.models import Province

    return [
        ProvinceOut(id=p.id, name=p.name)
        for p in db.scalars(select(Province).order_by(Province.name))
    ]


@router.get("/geo/cities", response_model=list[CityOut])
def search_cities(
    province_id: int | None = None,
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1000000),
    _: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> list[CityOut]:
    rows = svc.search_cities(
        db,
        province_id=province_id,
        query=q,
        limit=limit,
        offset=offset,
    )

    return [
        CityOut(
            id=city.id,
            name=city.name,
            province_id=province.id,
            province_name=province.name,
        )
        for city, province in rows
    ]


@router.get("/geo/cities/{city_id}", response_model=CityOut)
def get_city(
    city_id: int,
    _: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> CityOut | JSONResponse:
    row = db.execute(
        select(City, Province)
        .join(Province, Province.id == City.province_id)
        .where(City.id == city_id)
    ).first()

    if row is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "city_not_found",
                    "message": "unknown city",
                }
            },
        )

    city, province = row
    return CityOut(
        id=city.id,
        name=city.name,
        province_id=province.id,
        province_name=province.name,
    )

@router.get("/geo/districts", response_model=list[str])
def suggest_districts(
    city_id: int,
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1000000),
    _: AuthContext = Depends(get_context),
    db: Session = Depends(get_data_db),
) -> list[str]:
    return svc.suggest_districts(
        db,
        city_id=city_id,
        query=q,
        limit=limit,
        offset=offset,
    )