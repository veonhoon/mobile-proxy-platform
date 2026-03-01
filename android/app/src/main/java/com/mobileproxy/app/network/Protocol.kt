package com.mobileproxy.app.network

import org.json.JSONObject

object Protocol {
    const val REQUEST_ID_LENGTH = 36

    // Create a register message
    fun createRegisterMessage(deviceKey: String, name: String, carrier: String?, ip: String?): String {
        val deviceInfo = JSONObject().apply {
            put("name", name)
            carrier?.let { put("carrier", it) }
            ip?.let { put("ip", it) }
        }
        return JSONObject().apply {
            put("type", "register")
            put("deviceKey", deviceKey)
            put("deviceInfo", deviceInfo)
        }.toString()
    }

    // Create a pong message
    fun createPongMessage(): String {
        return JSONObject().apply { put("type", "pong") }.toString()
    }

    // Create proxy response headers message
    fun createResponseHeaders(requestId: String, statusCode: Int, headers: Map<String, String>): String {
        val headersJson = JSONObject()
        headers.forEach { (key, value) -> headersJson.put(key, value) }
        return JSONObject().apply {
            put("type", "proxy_response_headers")
            put("requestId", requestId)
            put("statusCode", statusCode)
            put("headers", headersJson)
        }.toString()
    }

    // Create proxy response end message
    fun createResponseEnd(requestId: String): String {
        return JSONObject().apply {
            put("type", "proxy_response_end")
            put("requestId", requestId)
        }.toString()
    }

    // Create proxy error message
    fun createProxyError(requestId: String, error: String): String {
        return JSONObject().apply {
            put("type", "proxy_error")
            put("requestId", requestId)
            put("error", error)
        }.toString()
    }

    // Create connect established message
    fun createConnectEstablished(requestId: String): String {
        return JSONObject().apply {
            put("type", "connect_established")
            put("requestId", requestId)
        }.toString()
    }

    // Create binary frame: requestId (36 bytes) + payload
    fun createBinaryFrame(requestId: String, data: ByteArray): ByteArray {
        val idBytes = requestId.padEnd(REQUEST_ID_LENGTH).toByteArray(Charsets.UTF_8)
        return idBytes + data
    }

    // Parse binary frame
    fun parseBinaryFrame(data: ByteArray): Pair<String, ByteArray> {
        val requestId = String(data, 0, REQUEST_ID_LENGTH, Charsets.UTF_8).trim()
        val payload = data.copyOfRange(REQUEST_ID_LENGTH, data.size)
        return Pair(requestId, payload)
    }
}
