# Hämta ditt projektnummer först (om du inte redan har det i huvudet)
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

# Ge Cloud Run-kontot läs- och skrivrättigheter (Storage Object User) till din hink
gcloud storage buckets add-iam-policy-binding gs://tjenamors-musikquiz-media \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectUser"
