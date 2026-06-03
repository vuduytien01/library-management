# Script to finish R2 setup and upload "Hiểu về trái tim"
Write-Host "--- Starting R2 Setup ---" -ForegroundColor Cyan

# 1. Login if needed
Write-Host "Step 1: Authenticating with Cloudflare..."
npx wrangler login

# 2. Create the bucket
Write-Host "Step 2: Creating R2 bucket 'biblio-tech-audio'..."
npx wrangler r2 bucket create biblio-tech-audio

# 3. Deploy the worker
Write-Host "Step 3: Deploying the upload worker..."
cd r2-audio-worker
npx wrangler deploy
cd ..

# 4. Upload the file
Write-Host "Step 4: Uploading the file to R2..."
npx wrangler r2 object put biblio-tech-audio/"Hiểu về trái tim-Minh Niệm.aac" --file="D:\Hiểu về trái tim-Minh Niệm.aac"

Write-Host "--- DONE! Your file is now on Cloudflare R2 ---" -ForegroundColor Green
