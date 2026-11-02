import { onRequestPost as __api_cpq_quotes__id__crm_js_onRequestPost } from "/home/claude/ezup-site/functions/api/cpq/quotes/[id]/crm.js"
import { onRequestGet as __api_cpq_quotes__id__js_onRequestGet } from "/home/claude/ezup-site/functions/api/cpq/quotes/[id].js"
import { onRequestPost as __api_cpq_quotes__id__js_onRequestPost } from "/home/claude/ezup-site/functions/api/cpq/quotes/[id].js"
import { onRequestPut as __api_cpq_quotes__id__js_onRequestPut } from "/home/claude/ezup-site/functions/api/cpq/quotes/[id].js"
import { onRequestGet as __api_cpq_quotes_index_js_onRequestGet } from "/home/claude/ezup-site/functions/api/cpq/quotes/index.js"
import { onRequestPost as __api_cpq_quotes_index_js_onRequestPost } from "/home/claude/ezup-site/functions/api/cpq/quotes/index.js"
import { onRequestGet as __api_cpq_settings_js_onRequestGet } from "/home/claude/ezup-site/functions/api/cpq/settings.js"
import { onRequestPut as __api_cpq_settings_js_onRequestPut } from "/home/claude/ezup-site/functions/api/cpq/settings.js"
import { onRequestPost as __api_request_js_onRequestPost } from "/home/claude/ezup-site/functions/api/request.js"
import { onRequest as __api_cpq__middleware_js_onRequest } from "/home/claude/ezup-site/functions/api/cpq/_middleware.js"
import { onRequest as __api_request_js_onRequest } from "/home/claude/ezup-site/functions/api/request.js"

export const routes = [
    {
      routePath: "/api/cpq/quotes/:id/crm",
      mountPath: "/api/cpq/quotes/:id",
      method: "POST",
      middlewares: [],
      modules: [__api_cpq_quotes__id__crm_js_onRequestPost],
    },
  {
      routePath: "/api/cpq/quotes/:id",
      mountPath: "/api/cpq/quotes",
      method: "GET",
      middlewares: [],
      modules: [__api_cpq_quotes__id__js_onRequestGet],
    },
  {
      routePath: "/api/cpq/quotes/:id",
      mountPath: "/api/cpq/quotes",
      method: "POST",
      middlewares: [],
      modules: [__api_cpq_quotes__id__js_onRequestPost],
    },
  {
      routePath: "/api/cpq/quotes/:id",
      mountPath: "/api/cpq/quotes",
      method: "PUT",
      middlewares: [],
      modules: [__api_cpq_quotes__id__js_onRequestPut],
    },
  {
      routePath: "/api/cpq/quotes",
      mountPath: "/api/cpq/quotes",
      method: "GET",
      middlewares: [],
      modules: [__api_cpq_quotes_index_js_onRequestGet],
    },
  {
      routePath: "/api/cpq/quotes",
      mountPath: "/api/cpq/quotes",
      method: "POST",
      middlewares: [],
      modules: [__api_cpq_quotes_index_js_onRequestPost],
    },
  {
      routePath: "/api/cpq/settings",
      mountPath: "/api/cpq",
      method: "GET",
      middlewares: [],
      modules: [__api_cpq_settings_js_onRequestGet],
    },
  {
      routePath: "/api/cpq/settings",
      mountPath: "/api/cpq",
      method: "PUT",
      middlewares: [],
      modules: [__api_cpq_settings_js_onRequestPut],
    },
  {
      routePath: "/api/request",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_request_js_onRequestPost],
    },
  {
      routePath: "/api/cpq",
      mountPath: "/api/cpq",
      method: "",
      middlewares: [__api_cpq__middleware_js_onRequest],
      modules: [],
    },
  {
      routePath: "/api/request",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_request_js_onRequest],
    },
  ]