package com.mobileproxy.app.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.telephony.TelephonyManager
import android.util.Log
import okhttp3.*
import okio.ByteString
import org.json.JSONObject
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.concurrent.TimeUnit

class WebSocketClient(
    private val context: Context,
    private val serverUrl: String,
    private val deviceKey: String,
    private val listener: ConnectionListener
) : WebSocketListener(), ProxyRequestExecutor.WebSocketSender {

    companion object {
        private const val TAG = "WSClient"
        private const val RECONNECT_DELAY_MS = 5000L
        private const val MAX_RECONNECT_DELAY_MS = 30000L
    }

    interface ConnectionListener {
        fun onConnected()
        fun onDisconnected()
        fun onRegistered(deviceId: String)
        fun onError(message: String)
        fun onStatsUpdate(activeConnections: Int)
        fun onChangeIpRequested()
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MINUTES) // No read timeout for WebSocket
        .writeTimeout(15, TimeUnit.SECONDS)
        .pingInterval(25, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var isRunning = false
    private var reconnectDelay = RECONNECT_DELAY_MS
    private lateinit var proxyExecutor: ProxyRequestExecutor

    fun connect() {
        isRunning = true
        proxyExecutor = ProxyRequestExecutor(this)
        doConnect()
    }

    fun disconnect() {
        isRunning = false
        proxyExecutor.closeAll()
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
    }

    fun isConnected(): Boolean {
        return webSocket != null && isRunning
    }

    private fun doConnect() {
        if (!isRunning) return

        val request = Request.Builder()
            .url(serverUrl)
            .build()

        webSocket = client.newWebSocket(request, this)
        Log.i(TAG, "Connecting to $serverUrl...")
    }

    // WebSocketListener overrides

    override fun onOpen(webSocket: WebSocket, response: Response) {
        Log.i(TAG, "WebSocket connected")
        reconnectDelay = RECONNECT_DELAY_MS
        listener.onConnected()

        // Send register message
        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
        val carrier = getCarrierName()
        val ip = getMobileIp()

        val registerMsg = Protocol.createRegisterMessage(deviceKey, deviceName, carrier, ip)
        webSocket.send(registerMsg)
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
        try {
            val json = JSONObject(text)
            when (json.getString("type")) {
                "ping" -> {
                    webSocket.send(Protocol.createPongMessage())
                }
                "registered" -> {
                    val deviceId = json.getString("deviceId")
                    Log.i(TAG, "Registered as device: $deviceId")
                    listener.onRegistered(deviceId)
                }
                "proxy_request" -> {
                    proxyExecutor.executeHttpRequest(json)
                }
                "connect_request" -> {
                    proxyExecutor.executeConnectRequest(json)
                }
                "change_ip" -> {
                    Log.i(TAG, "Received change_ip command from server")
                    listener.onChangeIpRequested()
                }
                "error" -> {
                    val msg = json.optString("message", "Unknown error")
                    Log.e(TAG, "Server error: $msg")
                    listener.onError(msg)
                }
                else -> {
                    Log.w(TAG, "Unknown message type: ${json.getString("type")}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing message: ${e.message}", e)
        }
    }

    override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
        // Binary frame from server (data for CONNECT tunnels)
        val data = bytes.toByteArray()
        if (data.size > Protocol.REQUEST_ID_LENGTH) {
            val (requestId, payload) = Protocol.parseBinaryFrame(data)
            proxyExecutor.handleIncomingData(requestId, payload)
        }
    }

    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
        Log.i(TAG, "WebSocket closing: $code $reason")
        webSocket.close(1000, null)
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        Log.i(TAG, "WebSocket closed: $code $reason")
        listener.onDisconnected()
        proxyExecutor.closeAll()
        scheduleReconnect()
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        Log.e(TAG, "WebSocket failure: ${t.message}")
        listener.onDisconnected()
        listener.onError(t.message ?: "Connection failed")
        proxyExecutor.closeAll()
        scheduleReconnect()
    }

    // WebSocketSender implementation

    override fun sendText(message: String) {
        webSocket?.send(message)
    }

    override fun sendBinary(data: ByteArray) {
        webSocket?.send(ByteString.of(*data))
    }

    // Helpers

    private fun scheduleReconnect() {
        if (!isRunning) return
        Log.i(TAG, "Reconnecting in ${reconnectDelay}ms...")
        Thread {
            Thread.sleep(reconnectDelay)
            reconnectDelay = (reconnectDelay * 2).coerceAtMost(MAX_RECONNECT_DELAY_MS)
            doConnect()
        }.start()
    }

    private fun getCarrierName(): String? {
        return try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            tm.networkOperatorName?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            null
        }
    }

    private fun getMobileIp(): String? {
        return try {
            NetworkInterface.getNetworkInterfaces()?.toList()
                ?.flatMap { it.inetAddresses.toList() }
                ?.firstOrNull { !it.isLoopbackAddress && it is Inet4Address }
                ?.hostAddress
        } catch (e: Exception) {
            null
        }
    }
}
