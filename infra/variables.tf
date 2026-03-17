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
