from typing import Optional

import httpx
from database import datasource_repo
from database.datasource_repo import create, datasource_exists
from database.models import DataSource
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from helpers.authorization import required_roles
from helpers.cipher import encrypt
from helpers.urlmapping import ApiType, add_URL_sasToken
from motor.core import AgnosticCollection
from pydantic import SecretStr

router = APIRouter()


@router.post("/api/datasources", status_code=201, response_model=DataSource)
async def create_datasource(
    datasource: DataSource,
    datasources: AgnosticCollection = Depends(datasource_repo.collection),
    current_user: Optional[dict] = Depends(required_roles()),
):
    """
    Create a new datasource. The datasource will be henceforth identified by account/container which
    must be unique or this function will return a 400.
    """
    if await datasource_exists(datasource.account, datasource.container):
        raise HTTPException(status_code=409, detail="Datasource Already Exists")

    datasource = await create(datasource=datasource)
    return datasource


@router.get("/api/datasources", response_model=list[DataSource])
async def get_datasources(
    datasources_collection: AgnosticCollection = Depends(datasource_repo.collection),
    current_user: Optional[dict] = Depends(required_roles()),
):
    datasources = datasources_collection.find()
    result = []
    async for datasource_item in datasources:
        result.append(datasource_item)
    return result


@router.get(
    "/api/datasources/{account}/{container}/image", response_class=StreamingResponse
)
async def get_datasource_image(
    account: str,
    container: str,
    datasources_collection: AgnosticCollection = Depends(datasource_repo.collection),
    current_user: Optional[dict] = Depends(required_roles()),
):
    # Create the imageURL with sasToken
    datasource = await datasources_collection.find_one(
        {
            "account": account,
            "container": container,
        }
    )
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")

    if not datasource["sasToken"]:
        datasource["sasToken"] = ""  # set to empty str if null

    imageURL = add_URL_sasToken(
        account, container, datasource["sasToken"], "", ApiType.IMAGE
    )

    async with httpx.AsyncClient() as client:
        response = await client.get(imageURL.get_secret_value())
    if response.status_code != 200:
        raise HTTPException(status_code=404, detail="Image not found")

    return StreamingResponse(
        response.iter_bytes(), media_type=response.headers["Content-Type"]
    )


@router.get(
    "/api/datasources/{account}/{container}/datasource", response_model=DataSource
)
async def get_datasource(
    datasource: DataSource = Depends(datasource_repo.get),
    current_user: Optional[dict] = Depends(required_roles()),
):
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")

    return datasource


@router.put("/api/datasources/{account}/{container}/datasource", status_code=204)
async def update_datasource(
    account: str,
    container: str,
    datasource: DataSource,
    datasources_collection: AgnosticCollection = Depends(datasource_repo.collection),
    current_user: Optional[dict] = Depends(required_roles()),
):
    existing_datasource = await datasources_collection.find_one(
        {
            "account": account,
            "container": container,
        }
    )
    if not existing_datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")

    # If the incoming datasource has a sasToken, encrypt it and replace the existing one
    # Once encrypted sasToken is just a str not a SecretStr anymore
    if datasource.sasToken and isinstance(datasource.sasToken, SecretStr):
        datasource.sasToken = encrypt(datasource.sasToken)  # returns a str

    datasource_dict = datasource.dict(by_alias=True, exclude_unset=True)

    # if sasToken is "" or null then set it to a empty str instead of SecretStr
    if not datasource.sasToken:
        datasource_dict["sasToken"] = ""

    await datasources_collection.update_one(
        {"account": account, "container": container},
        {"$set": datasource_dict},
    )

    return


@router.put("/api/datasources/{account}/{container}/sync", status_code=204)
async def sync_datasource(
    account: str,
    container: str,
    background_tasks: BackgroundTasks,
    datasources_collection: AgnosticCollection = Depends(datasource_repo.collection),
):
    existing_datasource = await datasources_collection.find_one(
        {
            "account": account,
            "container": container,
        }
    )
    if not existing_datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    background_tasks.add_task(datasource_repo.sync, account, container)
    return {"message": "Syncing"}
