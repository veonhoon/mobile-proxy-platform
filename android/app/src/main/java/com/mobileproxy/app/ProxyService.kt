package com.mobileproxy.app

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.mobileproxy.app.network.WebSocketClient

class ProxyService : Service(), WebSocketClient.ConnectionListener {

    companion object {
        private const val TAG = "ProxyService"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "proxy_service"

        const val ACTION_START = "com.mobileproxy.app.START"
        const val ACTION_STOP = "com.mobileproxy.app.STOP"
        const val EXTRA_SERVER_URL = "server_url"
        const val EXTRA_DEVICE_KEY = "device_key"

        // Broadcast actions for UI updates
        const val BROADCAST_STATUS = "com.mobileproxy.app.STATUS"
        const val EXTRA_STATUS = "status"
        const val EXTRA_DEVICE_ID = "device_id"
        const val EXTRA_ERROR = "error"

        const val STATUS_CONNECTED = "connected"
        const val STATUS_DISCONNECTED = "disconnected"
        const val STATUS_REGISTERED = "registered"
        const val STATUS_ERROR = "error"
    }

    private var wsClient: WebSocketClient? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val serverUrl = intent.getStringExtra(EXTRA_SERVER_URL) ?: return START_NOT_STICKY
                val deviceKey = intent.getStringExtra(EXTRA_DEVICE_KEY) ?: return START_NOT_STICKY

                startForeground(NOTIFICATION_ID, createNotification("Connecting..."))
                acquireWakeLock()
                startProxy(serverUrl, deviceKey)
            }
            ACTION_STOP -> {
                stopProxy()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopProxy()
        releaseWakeLock()
        super.onDestroy()
    }

    private fun startProxy(serverUrl: String, deviceKey: String) {
        wsClient?.disconnect()
        wsClient = WebSocketClient(this, serverUrl, deviceKey, this)
        wsClient?.connect()
        Log.i(TAG, "Proxy service started, connecting to $serverUrl")
    }

    private fun stopProxy() {
        wsClient?.disconnect()
        wsClient = null
        Log.i(TAG, "Proxy service stopped")
    }

    // ConnectionListener callbacks

    override fun onConnected() {
        updateNotification("Connected to server")
        broadcastStatus(STATUS_CONNECTED)
    }

    override fun onDisconnected() {
        updateNotification("Disconnected - reconnecting...")
        broadcastStatus(STATUS_DISCONNECTED)
    }

    override fun onRegistered(deviceId: String) {
        updateNotification("Active - Device registered")
        broadcastStatus(STATUS_REGISTERED, deviceId = deviceId)
    }

    override fun onError(message: String) {
        broadcastStatus(STATUS_ERROR, error = message)
    }

    override fun onStatsUpdate(activeConnections: Int) {
        updateNotification("Active - $activeConnections connections")
    }

    // Notification helpers

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notification_channel_description)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MobileProxy")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, createNotification(text))
    }

    private fun broadcastStatus(status: String, deviceId: String? = null, error: String? = null) {
        val intent = Intent(BROADCAST_STATUS).apply {
            putExtra(EXTRA_STATUS, status)
            deviceId?.let { putExtra(EXTRA_DEVICE_ID, it) }
            error?.let { putExtra(EXTRA_ERROR, it) }
        }
        sendBroadcast(intent)
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MobileProxy::ProxyWakeLock")
        wakeLock?.acquire(Long.MAX_VALUE) // Keep CPU awake
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }
}
