variable "resource_group_name" {
  type        = string
  description = "リソースグループ名"
  default     = "megaro-web-rg"
}

variable "location" {
  type        = string
  description = "リージョン"
  default     = "eastasia"
}

variable "app_name" {
  type        = string
  description = "Static Web App"
  default     = "megaro-web"
}

variable "environment" {
  type        = string
  description = "環境名 (例: production, staging, development)"
}

variable "yahoo_app_id" {
  type        = string
  description = "Yahoo! Japan Developer Network の App ID"
  sensitive   = true
}

variable "storage_account_prefix" {
  type        = string
  description = "Storage account name prefix (must be lowercase alphanumeric)"
  default     = "megaro"
}

variable "allowed_origins" {
  type        = list(string)
  description = "Allowed origins for SignalR Service CORS"
  default     = []
}
