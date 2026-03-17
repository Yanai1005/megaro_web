output "swa_url" {
  description = "Static Web App のデフォルトホスト名"
  value       = "https://${azurerm_static_web_app.swa.default_host_name}"
}

output "swa_api_key" {
  description = "デプロイ用 API キー (GitHub Actions の Secret に設定する)"
  value       = azurerm_static_web_app.swa.api_key
  sensitive   = true
}
