terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "random_id" "storage_suffix" {
  byte_length = 4
  keepers = {
    prefix = var.storage_account_prefix
  }
}

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_static_web_app" "swa" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location

  sku_tier = "Free"
  sku_size = "Free"

  tags = {
    environment = var.environment
  }
}

# Azure Storage Account (Table Storage for game state)
resource "azurerm_storage_account" "sa" {
  name                     = "${var.storage_account_prefix}${random_id.storage_suffix.hex}"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  https_traffic_only_enabled = true
}

# Azure SignalR Service (Serverless mode, Free tier: 20接続/20,000msg/日)
resource "azurerm_signalr_service" "srs" {
  name                = "megaro-signalr"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku {
    name     = "Free_F1"
    capacity = 1
  }
  service_mode = "Serverless"
  cors {
    allowed_origins = length(var.allowed_origins) > 0 ? var.allowed_origins : [
      "https://${azurerm_static_web_app.swa.default_host_name}",
      "http://localhost:5173"
    ]
  }
}

# App Service Plan (Consumption = Y1 = 実質無料)
resource "azurerm_service_plan" "asp" {
  name                = "megaro-asp"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "Y1"
}

# Linux Function App
resource "azurerm_linux_function_app" "fa" {
  name                       = "megaro-api"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  storage_account_name       = azurerm_storage_account.sa.name
  storage_account_access_key = azurerm_storage_account.sa.primary_access_key
  service_plan_id            = azurerm_service_plan.asp.id

  site_config {
    application_stack {
      node_version = "20"
    }
    cors {
      allowed_origins = [
        "https://${azurerm_static_web_app.swa.default_host_name}",
        "http://localhost:5173"
      ]
    }
  }

  app_settings = {
    AzureSignalRConnectionString = azurerm_signalr_service.srs.primary_connection_string
    AzureWebJobsStorage          = azurerm_storage_account.sa.primary_connection_string
    YAHOO_APP_ID                 = var.yahoo_app_id
    FUNCTIONS_WORKER_RUNTIME     = "node"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "false"
  }
}
