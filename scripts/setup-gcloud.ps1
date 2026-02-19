param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectId
)

$ErrorActionPreference = "Stop"

gcloud config set project $ProjectId

gcloud services enable storage.googleapis.com firestore.googleapis.com aiplatform.googleapis.com documentai.googleapis.com vision.googleapis.com cloudfunctions.googleapis.com firebase.googleapis.com

gcloud iam service-accounts create rag-functions --display-name="RAG System Functions" 2>$null
$serviceAccount = "rag-functions@$ProjectId.iam.gserviceaccount.com"

$roles = @(
  "roles/storage.admin",
  "roles/datastore.user",
  "roles/aiplatform.user",
  "roles/ml.developer"
)

foreach ($role in $roles) {
  gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$serviceAccount" --role=$role
}

$bucketName = "$ProjectId-documents"
gsutil mb -p $ProjectId -c STANDARD -l us-central1 "gs://$bucketName" 2>$null
gsutil uniformbucketlevelaccess set on "gs://$bucketName"

Write-Host "Setup complete for project: $ProjectId"