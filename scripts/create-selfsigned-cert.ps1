# Self-signed code signing certificate for local Windows installer testing.
# Run in PowerShell as Administrator.
#
# After running, import the .pfx into Windows certificate store and copy the
# thumbprint into apps/client-desktop/src-tauri/tauri.conf.json:
#   "bundle": { "windows": { "certificateThumbprint": "<thumbprint>" } }
#
# Or set env var before building:
#   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "volle123"

$certName = "Volle Dev Signing"
$password = ConvertTo-SecureString -String "volle123" -Force -AsPlainText
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$certName" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -CertStoreLocation Cert:\CurrentUser\My `
    -NotAfter (Get-Date).AddYears(5)

$thumbprint = $cert.Thumbprint
Write-Host "Certificate thumbprint: $thumbprint" -ForegroundColor Green

$certPath = Join-Path $PSScriptRoot "volle-dev-cert.pfx"
Export-PfxCertificate `
    -Cert "Cert:\CurrentUser\My\$thumbprint" `
    -FilePath $certPath `
    -Password $password | Out-Null

Write-Host "Exported to: $certPath" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Double-click $certPath and import to Local Machine -> Trusted Root + Trusted Publishers"
Write-Host "2. Copy thumbprint into tauri.conf.json (bundle.windows.certificateThumbprint)"
Write-Host "3. Run: cargo tauri build"
