# vim: tabstop=4 shiftwidth=4 expandtab


test_datasource = {
    "name": "name",
    "accountName": "accountName",
    "containerName": "containerName",
    "description": "description",
}

test_datasource_id = (
    f'{test_datasource["accountName"]}_{test_datasource["containerName"]}'
)


def test_api_get_config(client):
    response = client.get("/api/config")
    assert response.status_code == 200


def test_api_returns_ok(client):
    response = client.get("/api/status")
    assert response.status_code == 200
    assert response.json() == "OK"

# This test no longer valid as URL will never be valid with made up accountName and containerName
def test_api_post_meta_bad_datasource_id(client):
    response = client.post("/api/datasources/nota/validid/file_path/meta", json={})
    assert response.status_code == 404


def test_api_post_meta_missing_datasource(client):
    source_id = "madeup/datasource"
    response = client.post(f"/api/datasources/{source_id}/file_path/meta", json={})
    assert response.status_code == 404


def test_api_post_meta(client):
    client.post("/api/datasources", json=test_datasource).json()
    response = client.post(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta', json={}
    )
    assert response.status_code == 201


def test_api_post_existing_meta(client):
    client.post("/api/datasources", json=test_datasource).json()
    response = client.post(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta', json={}
    )
    response = client.post(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta', json={}
    )
    assert response.status_code == 400


def test_api_put_meta(client):
    client.post("/api/datasources", json=test_datasource).json()
    response = client.post(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta', json={}
    )
    assert response.status_code == 201
    response = client.put(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta', json={}
    )
    assert response.status_code == 204


def test_api_put_meta_not_existing(client):
    client.post("/api/datasources", json=test_datasource).json()
    response = client.put(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta', json={}
    )
    assert response.status_code == 404


def test_api_get_meta(client):
    client.post("/api/datasources", json=test_datasource).json()
    response = client.post(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta', json={"test": "string"}
    )
    response = client.get(f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta')
    assert response.status_code == 200
    assert response.json()["version_number"] == 0
    assert response.json()["metadata"]["test"] == "string"


def test_api_get_meta_not_existing(client):
    response = client.get('/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta')
    assert response.status_code == 404  # Because the datasource doesn't exist
    client.post("/api/datasources", json=test_datasource).json()
    response = client.get('/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/file_path/meta')
    assert response.status_code == 404  # Because the metadata doesn't exist


def test_api_get_all_meta(client):
    client.post("/api/datasources", json=test_datasource).json()
    client.post(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/record_a/meta', json={"record": "a"}
    )
    client.post(
        f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/record_b/meta', json={"record": "b"}
    )
    response = client.get(f'/api/datasources/{test_datasource["accountName"]}/{test_datasource["containerName"]}/meta')
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_api_create_datasource(client):
    response = client.post("/api/datasources", json=test_datasource)
    assert response.status_code == 201


def test_api_get_datasources(client):
    response = client.get("/api/datasources")
    assert response.status_code == 200
    assert len(response.json()) == 0

    response = client.post("/api/datasources", json=test_datasource)
    response = client.get("/api/datasources")
    assert response.status_code == 200
    assert len(response.json()) == 1
