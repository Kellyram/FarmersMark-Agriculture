from google.cloud import storage


def download_blob_as_bytes(client: storage.Client, bucket_name: str, blob_path: str) -> bytes:
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)
    return blob.download_as_bytes()