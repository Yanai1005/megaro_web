output "swa_url" {
  description = "Static Web App のデフォルトホスト名"
  value       = "https://${azurerm_static_web_app.swa.default_host_name}"
}

output "swa_api_key" {
  description = "デプロイ用 API キー (GitHub Actions の Secret に設定する)"
  value       = azurerm_static_web_app.swa.api_key
  sensitive   = true
}

output "functions_app_url" {
  description = "Azure Functions App のベース URL"
  value       = "https://${azurerm_linux_function_app.fa.default_hostname}"
}

output "signalr_connection_string" {
  description = "SignalR Service の接続文字列 (Functions App の設定に使用)"
  value       = azurerm_signalr_service.srs.primary_connection_string
  sensitive   = true
}
