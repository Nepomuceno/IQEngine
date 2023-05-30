# vim: tabstop=4 shiftwidth=4 expandtab

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from handlers.config import router as config_router
from handlers.datasources import router as datasources_router
from handlers.metadata import router as metadata_router
from handlers.status import router as status_router

load_dotenv()

if "RFDX_FF_INMEMDB" in os.environ and os.environ["RFDX_FF_INMEMDB"] != str("0"):
    import database.database

    database.database.db = database.database.db_inmem


# check if the iqengine directory exists and create it if not
if not os.path.exists("iqengine"):
    os.makedirs("iqengine")

app = FastAPI()
app.include_router(datasources_router)
app.include_router(metadata_router)
app.include_router(status_router)
app.include_router(config_router)
app.mount("/", StaticFiles(directory="iqengine", html=True), name="iqengine")

if __name__ == "__main__":
    print("Cannot be run standalone. Do 'uvicorn main:app' instead")
