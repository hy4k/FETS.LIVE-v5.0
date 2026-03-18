# PowerShell script to run profile picture migrations
# Run this script from the project root directory

Write-Host "Running profile picture migrations..." -ForegroundColor Green

# Check if supabase CLI is available
if (!(Get-Command "supabase" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Supabase CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "Install with: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

# Run the migrations
Write-Host "Applying avatar_url migration..." -ForegroundColor Yellow
supabase db push --file supabase/migrations/1759000001_add_avatar_url_to_staff_profiles.sql

Write-Host "Applying foreign key updates..." -ForegroundColor Yellow  
supabase db push --file supabase/migrations/1759000002_update_fets_connect_foreign_keys.sql

Write-Host "Profile picture migrations completed successfully!" -ForegroundColor Green
Write-Host "You can now upload profile pictures in the Staff Management page." -ForegroundColor Cyan