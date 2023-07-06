import json
import os

from helpers.cipher import encrypt, decrypt
from database.database import datasources_collection, metadata_collection
from database.models import DataSource
from azure.storage.blob import ContainerClient


def import_metadata_from_datasource(datasource: DataSource):
    """
    Import metadata files from a blob storage datasource
    """
    
    client = None
    client = ContainerClient.from_container_url(f"https://{datasource.account}.blob.core.windows.net/{datasource.container}")
    blobs = client.list_blob_names()
    blob_names = []
    metadata_collection = 
    for blob in blobs:
        blob_names.append(blob)
    if len(blob_names) > 0:

    pass

def import_datasources_from_env(environment_variable_name="IQENGINE_IMPORT_DB"):
    """
    Import datasources from environment variable
    """
    try:
        datasources_json = os.getenv(environment_variable_name, None)
        if not datasources_json:
            return None
        datasources_json = json.loads(datasources_json)
        # convert json to datasource objects
        datasources: list[DataSource] = []
        for datasource_json in datasources_json:
            datasource_json['type'] = "api"
            datasource = DataSource(**datasource_json)
            datasources.append(datasource)

        client = datasources_collection()
        for datasource in datasources:
            if client.find_one({"account": datasource.account, "container": datasource.container}) is None:
                if datasource.sasToken is not None:
                    datasource.sasToken = encrypt(datasource.sasToken)
                    print(datasource.sasToken)
                import_metadata_from_datasource(datasource)
        
    except Exception as e:
        # throw a custom datasource failed to load exception
        raise Exception(
            f"Failed to load datasources from environment variable {environment_variable_name}",
            e,
        )