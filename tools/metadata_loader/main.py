import os
import json
import requests
import argparse
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient, ContainerClient, BlobClient
from urllib.parse import quote

# given the datasource details
# given the folder
# enumerate the files in the folder
# for each one
#     read the file
#     call the create meta api

def get_config():
    load_dotenv()
    return {
        "API_URL_BASE": os.environ.get("API_URL_BASE"),
        "STORAGE_ACCOUNT_URL": os.environ.get("STORAGE_ACCOUNT_URL"),
        "STORAGE_CONNECTION_STRING": os.environ.get("STORAGE_CONNECTION_STRING"),
        "STORAGE_SAS_KEY": os.environ.get("STORAGE_SAS_KEY")
    }

def call_get_datasources_api(url):
    return requests.get(url)

def get_datasources(args):

    config = get_config()

    url = f'{config["API_URL_BASE"]}/api/datasources'
    resp = call_get_datasources_api(url)

    print(resp.text)

    return resp.text


def call_create_datasource_api(url, payload):
    return requests.post(url, json=payload)

def create_datasource(args):

    config = get_config()

    url = f'{config["API_URL_BASE"]}/api/datasources'
    data = {
        "name": f'{args.name}',
        "accountName": f'{args.accountName}',
        "containerName": f'{args.containerName}',
        "description": f'{args.description}'
    }
    resp = call_create_datasource_api(url, payload=data)

    print(resp.text)

    return resp.text


def call_get_all_metadata_api(url:str):
    return requests.get(url)
    
def get_all_meta(args):
    
    config = get_config()
    
    url = f'{config["API_URL_BASE"]}/api/datasources/{args.accountName}/{args.containerName}/meta'
    resp = call_get_all_metadata_api(url)

    items = json.loads(resp.text)
    if len(items) == 0:
        print(f"There are no items in account: {args.accountName}, container: {args.containerName}.")
    else:
        for item in items:
            print(f"Account: {item['accountName']}, Container: {item['containerName']}, filepath: {item['filepath'].replace('(slash)', '/')}")

    return resp.text

def call_create_meta_api(url, payload):
    return requests.post(url, json=payload)

def create_meta(accountName: str, containerName: str, filepath: str, document: str):

    config = get_config()

    #quoted_filepath = quote(filepath, safe='')
    quoted_filepath = filepath.replace("/", "(slash)")
    url = f'{config["API_URL_BASE"]}/api/datasources/{accountName}/{containerName}/{quoted_filepath}/meta'
    resp = call_create_meta_api(url, payload=document)
    return resp.text


def initial_load_meta(args):

    config = get_config()

    storage_url = config["STORAGE_ACCOUNT_URL"]
    storage_sas = config["STORAGE_SAS_KEY"]
    blob_service_client = BlobServiceClient(account_url=storage_url, credential=storage_sas)
    container_client = blob_service_client.get_container_client(container=args.containerName)

    blob_list = container_client.list_blobs()

    overall_response = True
    for blob in blob_list:
        
        # print(blob.name)
        # if blob.name == "/dir1/dir2/abc.sigmf-meta"
        # then basename = abc.sigmf-meta, dirname = /dir1/dir2

        basename = os.path.basename(blob.name)
        parts = basename.split('.')
        if len(parts)<2 or parts[1] != 'sigmf-meta':
            continue

        blob_client = container_client.get_blob_client(blob=blob.name)
        downloader = blob_client.download_blob(max_concurrency=1, encoding='UTF-8')
        blob_text = downloader.readall()

        dirname = os.path.dirname(blob.name)
        filepath = f"{dirname}/{parts[0]}"

        resp = create_meta(args.accountName, args.containerName, filepath, blob_text)

        overall_response = overall_response and resp == "Success"
        
    return overall_response


def start():
# commands
# python main.py ...
#    datasource add -name -accountName -containerName -description
#    datasource list
#    metadata list
#    metadata addfolder -accountName -containerName -document
    parser = argparse.ArgumentParser(description='Tools for working with a metadata database.')
    subparsers = parser.add_subparsers()

    datasource_parser = subparsers.add_parser('datasource')
    datasource_subparsers = datasource_parser.add_subparsers()

    datasource_create_parser = datasource_subparsers.add_parser('create', description='Create a datasource')
    datasource_create_parser.add_argument("-name", required=True)
    datasource_create_parser.add_argument("-accountName", required=True)
    datasource_create_parser.add_argument("-containerName", required=True)
    datasource_create_parser.add_argument("-description", required=True)
    datasource_create_parser.set_defaults(func=create_datasource)

    datasource_list_parser = datasource_subparsers.add_parser('list', description='List all datasources')
    datasource_list_parser.set_defaults(func=get_datasources)
    
    metadata_parser = subparsers.add_parser('metadata')
    metadata_subparsers = metadata_parser.add_subparsers()

    metadata_list_parser = metadata_subparsers.add_parser('list')
    metadata_list_parser.add_argument("-accountName", required=True)
    metadata_list_parser.add_argument("-containerName", required=True)
    metadata_list_parser.set_defaults(func=get_all_meta)
    
    metadata_addfolder_parser = metadata_subparsers.add_parser('addfolder')
    metadata_addfolder_parser.add_argument("-accountName")
    metadata_addfolder_parser.add_argument("-containerName")
    metadata_addfolder_parser.set_defaults(func=initial_load_meta)

    args = parser.parse_args()
    args.func(args)

if __name__ == "__main__":
    start()
