# vim: tabstop=4 shiftwidth=4 expandtab
    
import os
from fastapi import FastAPI, Request

from database.database import create_db_client
from handlers.datasources import router as datasources_router
from handlers.metadata import router as metadata_router
from handlers.status import router as status_router

app = FastAPI()
app.include_router(datasources_router)
app.include_router(metadata_router)
app.include_router(status_router)

if __name__ == "__main__":
    print("Cannot be run standalone. Do 'uvicorn main:app' instead")