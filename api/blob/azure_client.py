from typing import Optional

from azure.storage.blob import BlobProperties
from azure.storage.blob.aio import BlobClient, ContainerClient
from database.models import Metadata
from helpers.urlmapping import ApiType, get_file_name
from pydantic import SecretStr
from rf.spectrogram import get_spectrogram_image


class AzureBlobClient:
    """
    AzureBlobClient is a wrapper around the Azure BlobClient class.


    Parameters
    ----------
    account : str
        The Azure account name.
    container : str
        The Azure container name.
    """

    account: str
    container: str
    sas_token: SecretStr = None
    clients: dict[str, BlobClient] = {}

    def __init__(self, account, container):
        self.account = account
        self.container = container

    def set_sas_token(self, sas_token):
        self.sas_token = sas_token

    def get_blob_client(self, filepath):
        if filepath in self.clients:
            return self.clients[filepath]
        if not self.sas_token:
            blob_client = BlobClient.from_blob_url(
                f"https://{self.account}.blob.core.windows.net/"
                f"{self.container}/{filepath}"
            )
        else:
            blob_client = BlobClient.from_blob_url(
                f"https://{self.account}.blob.core.windows.net/"
                f"{self.container}/{filepath}",
                credential=self.sas_token.get_secret_value(),
            )
        self.clients[filepath] = blob_client
        return blob_client

    def get_container_client(self):
        return ContainerClient.from_connection_string(
            f"https://{self.account}.blob.core.windows.net/",
            container_name=self.container,
            credential=self.sas_token.get_secret_value(),
        )

    async def get_blob_properties(self, filepath) -> BlobProperties:
        blob_client = self.get_blob_client(filepath)
        return await blob_client.get_blob_properties()

    async def get_blob_content(
        self, filepath: str, offset: Optional[int] = None, length: Optional[int] = None
    ) -> bytes:
        blob_client = self.get_blob_client(filepath)
        blob = await blob_client.download_blob(offset=offset, length=length)
        content = await blob.readall()
        return content

    async def get_blob_stream(
        self, filepath: str, offset: Optional[int] = None, length: Optional[int] = None
    ):
        blob_client = self.get_blob_client(filepath)
        blob = await blob_client.download_blob(offset=offset, length=length)
        return blob

    async def upload_blob(self, filepath: str, data: bytes):
        blob_client = self.get_blob_client(filepath)
        await blob_client.upload_blob(data, overwrite=True)

    async def get_new_thumbnail(self, data_type: str, filepath: str) -> bytes:
        iq_path = get_file_name(filepath, ApiType.IQDATA)
        fftSize = 1024
        content = await self.get_blob_content(iq_path, 8000, fftSize * 512)
        image = get_spectrogram_image(content, data_type, fftSize)
        return image

    async def get_metadata_files(self):
        container_client = self.get_container_client()
        # files that enf with .sigmf-meta
        async for blob in container_client.list_blobs():
            if blob.name.endswith(".sigmf-meta"):
                metadata = await self.get_metadata_file(blob.name)
                yield str(blob.name), metadata
        return

    async def get_metadata_file(self, filepath: str):
        blob_client = self.get_blob_client(filepath)
        blob = await blob_client.download_blob()
        content = await blob.readall()
        metadata = Metadata.parse_raw(content)
        return metadata

    async def blob_exist(self, filepath):
        blob_client = self.get_blob_client(filepath)
        return await blob_client.exists()

    async def get_file_length(self, filepath):
        blob_client = self.get_blob_client(filepath)
        blob = await blob_client.get_blob_properties()
        return int(blob.size)
