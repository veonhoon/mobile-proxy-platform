package com.mobileproxy.app.network

import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import okio.ByteString
import org.json.JSONObject
import java.io.InputStream
import java.io.OutputStream
import java.net.Socket
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ProxyRequestExecutor(private val webSocketSender: WebSocketSender) {
    companion object {
        private const val TAG = "ProxyExecutor"
        private const val BUFFER_SIZE = 8192
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .build()

    private val executor = Executors.newCachedThreadPool()

    interface WebSocketSender {
        fun sendText(message: String)
        fun sendBinary(data: ByteArray)
    }

    fun executeHttpRequest(message: JSONObject) {
        executor.execute {
            val requestId = message.getString("requestId")
            try {
                val method = message.getString("method")
                val url = message.getString("url")
                val headers = message.optJSONObject("headers")
                val bodyBase64 = message.optString("body", null)

                // Build request
                val requestBuilder = Request.Builder().url(url)

                // Add headers
                headers?.let {
                    val keys = it.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        requestBuilder.addHeader(key, it.getString(key))
                    }
                }

                // Set method and body
                val body = if (bodyBase64 != null) {
                    android.util.Base64.decode(bodyBase64, android.util.Base64.DEFAULT)
                        .toRequestBody("application/octet-stream".toMediaTypeOrNull())
                } else if (method in listOf("POST", "PUT", "PATCH")) {
                    ByteArray(0).toRequestBody(null)
                } else {
                    null
                }
                requestBuilder.method(method, body)

                // Execute request
                val response = httpClient.newCall(requestBuilder.build()).execute()

                // Send response headers
                val responseHeaders = mutableMapOf<String, String>()
                for (i in 0 until response.headers.size) {
                    responseHeaders[response.headers.name(i)] = response.headers.value(i)
                }

                webSocketSender.sendText(
                    Protocol.createResponseHeaders(requestId, response.code, responseHeaders)
                )

                // Stream response body
                response.body?.let { responseBody ->
                    val stream = responseBody.byteStream()
                    val buffer = ByteArray(BUFFER_SIZE)
                    var bytesRead: Int

                    while (stream.read(buffer).also { bytesRead = it } != -1) {
                        val chunk = buffer.copyOf(bytesRead)
                        webSocketSender.sendBinary(Protocol.createBinaryFrame(requestId, chunk))
                    }

                    stream.close()
                    responseBody.close()
                }

                // Signal end
                webSocketSender.sendText(Protocol.createResponseEnd(requestId))

            } catch (e: Exception) {
                Log.e(TAG, "HTTP request failed: ${e.message}", e)
                webSocketSender.sendText(
                    Protocol.createProxyError(requestId, e.message ?: "Unknown error")
                )
            }
        }
    }

    fun executeConnectRequest(message: JSONObject) {
        executor.execute {
            val requestId = message.getString("requestId")
            val host = message.getString("host")
            val port = message.getInt("port")

            try {
                // Open raw TCP socket to target
                val socket = Socket(host, port)
                socket.tcpNoDelay = true

                // Notify server that connection is established
                webSocketSender.sendText(Protocol.createConnectEstablished(requestId))

                val inputStream = socket.getInputStream()
                val outputStream = socket.getOutputStream()

                // Start reading from target and forwarding to server
                val readThread = Thread {
                    try {
                        val buffer = ByteArray(BUFFER_SIZE)
                        var bytesRead: Int
                        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                            val chunk = buffer.copyOf(bytesRead)
                            webSocketSender.sendBinary(Protocol.createBinaryFrame(requestId, chunk))
                        }
                    } catch (e: Exception) {
                        Log.d(TAG, "CONNECT read ended for $requestId: ${e.message}")
                    } finally {
                        webSocketSender.sendText(Protocol.createResponseEnd(requestId))
                        try { socket.close() } catch (_: Exception) {}
                    }
                }
                readThread.start()

                // Store socket for writing data from server
                activeConnections[requestId] = ConnectSession(socket, inputStream, outputStream, readThread)

            } catch (e: Exception) {
                Log.e(TAG, "CONNECT failed to $host:$port: ${e.message}", e)
                webSocketSender.sendText(
                    Protocol.createProxyError(requestId, e.message ?: "Connection failed")
                )
            }
        }
    }

    // Handle incoming binary data from server (for CONNECT tunnels)
    fun handleIncomingData(requestId: String, data: ByteArray) {
        executor.execute {
            val session = activeConnections[requestId] ?: return@execute
            try {
                session.outputStream.write(data)
                session.outputStream.flush()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to write to tunnel $requestId: ${e.message}")
                closeConnection(requestId)
            }
        }
    }

    fun closeConnection(requestId: String) {
        activeConnections.remove(requestId)?.let { session ->
            try { session.socket.close() } catch (_: Exception) {}
        }
    }

    fun closeAll() {
        activeConnections.keys.toList().forEach { closeConnection(it) }
    }

    private val activeConnections = mutableMapOf<String, ConnectSession>()

    private data class ConnectSession(
        val socket: Socket,
        val inputStream: InputStream,
        val outputStream: OutputStream,
        val readThread: Thread
    )
}
