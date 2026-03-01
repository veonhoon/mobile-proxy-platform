package com.mobileproxy.app

import android.Manifest
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val PREFS_NAME = "mobile_proxy_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_DEVICE_KEY = "device_key"
        private const val KEY_PAIRED_DEVICE_KEY = "paired_device_key"
        private const val NOTIFICATION_PERMISSION_CODE = 100
    }

    private lateinit var etServerUrl: EditText
    private lateinit var etDeviceKey: EditText
    private lateinit var btnConnect: MaterialButton
    private lateinit var btnChangeIp: MaterialButton
    private lateinit var btnResetPairing: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvDeviceId: TextView
    private lateinit var tvError: TextView

    private var isConnected = false
    private val handler = Handler(Looper.getMainLooper())
    private val httpClient = OkHttpClient()

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent ?: return
            val status = intent.getStringExtra(ProxyService.EXTRA_STATUS) ?: return

            runOnUiThread {
                when (status) {
                    ProxyService.STATUS_CONNECTED -> {
                        tvStatus.text = "Connected"
                        tvStatus.setTextColor(0xFFF59E0B.toInt()) // amber
                        tvError.visibility = View.GONE
                    }
                    ProxyService.STATUS_REGISTERED -> {
                        tvStatus.text = "Active"
                        tvStatus.setTextColor(0xFF22C55E.toInt()) // green
                        val deviceId = intent.getStringExtra(ProxyService.EXTRA_DEVICE_ID) ?: ""
                        tvDeviceId.text = "Device: $deviceId"
                        tvError.visibility = View.GONE
                        btnChangeIp.visibility = View.VISIBLE
                    }
                    ProxyService.STATUS_DISCONNECTED -> {
                        tvStatus.text = "Reconnecting..."
                        tvStatus.setTextColor(0xFFF59E0B.toInt())
                        btnChangeIp.visibility = View.GONE
                    }
                    ProxyService.STATUS_ERROR -> {
                        val error = intent.getStringExtra(ProxyService.EXTRA_ERROR) ?: ""
                        tvError.text = error
                        tvError.visibility = View.VISIBLE
                    }
                    ProxyService.STATUS_IP_CHANGING -> {
                        btnChangeIp.text = "Changing IP..."
                        btnChangeIp.isEnabled = false
                    }
                    ProxyService.STATUS_IP_CHANGED -> {
                        btnChangeIp.text = "Change IP"
                        btnChangeIp.isEnabled = true
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        etServerUrl = findViewById(R.id.etServerUrl)
        etDeviceKey = findViewById(R.id.etDeviceKey)
        btnConnect = findViewById(R.id.btnConnect)
        btnChangeIp = findViewById(R.id.btnChangeIp)
        btnResetPairing = findViewById(R.id.btnResetPairing)
        tvStatus = findViewById(R.id.tvStatus)
        tvDeviceId = findViewById(R.id.tvDeviceId)
        tvError = findViewById(R.id.tvError)

        // Load saved settings
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        etServerUrl.setText(prefs.getString(KEY_SERVER_URL, ""))

        // If we have a stored paired device key, show the pairing code input as paired
        val pairedKey = prefs.getString(KEY_PAIRED_DEVICE_KEY, null)
        if (pairedKey != null) {
            etDeviceKey.setText("Paired")
            etDeviceKey.isEnabled = false
            btnResetPairing.visibility = View.VISIBLE
        } else {
            etDeviceKey.setText(prefs.getString(KEY_DEVICE_KEY, ""))
        }

        btnConnect.setOnClickListener {
            if (isConnected) {
                stopProxyService()
            } else {
                startProxyService()
            }
        }

        btnChangeIp.setOnClickListener {
            val intent = Intent(this, ProxyService::class.java).apply {
                action = ProxyService.ACTION_CHANGE_IP
            }
            startService(intent)

            btnChangeIp.text = "Changing IP..."
            btnChangeIp.isEnabled = false
            // Re-enable after 10 seconds
            handler.postDelayed({
                btnChangeIp.text = "Change IP"
                btnChangeIp.isEnabled = true
            }, 10000)
        }

        btnResetPairing.setOnClickListener {
            prefs.edit().apply {
                remove(KEY_PAIRED_DEVICE_KEY)
                remove(KEY_DEVICE_KEY)
                apply()
            }
            etDeviceKey.setText("")
            etDeviceKey.isEnabled = true
            btnResetPairing.visibility = View.GONE
        }

        // Request notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    NOTIFICATION_PERMISSION_CODE
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(ProxyService.BROADCAST_STATUS)
        registerReceiver(statusReceiver, filter, RECEIVER_NOT_EXPORTED)
    }

    override fun onPause() {
        super.onPause()
        unregisterReceiver(statusReceiver)
    }

    private fun startProxyService() {
        val serverUrl = etServerUrl.text.toString().trim()
        val input = etDeviceKey.text.toString().trim()

        if (serverUrl.isEmpty()) {
            tvError.text = "Server URL is required"
            tvError.visibility = View.VISIBLE
            return
        }

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val storedDeviceKey = prefs.getString(KEY_PAIRED_DEVICE_KEY, null)

        if (storedDeviceKey != null) {
            // Already paired, use stored key directly
            prefs.edit().putString(KEY_SERVER_URL, serverUrl).apply()
            launchService(serverUrl, storedDeviceKey)
            return
        }

        if (input.isEmpty()) {
            tvError.text = "Pairing code is required"
            tvError.visibility = View.VISIBLE
            return
        }

        // Save server URL
        prefs.edit().putString(KEY_SERVER_URL, serverUrl).apply()

        // Check if input looks like a pairing code (6 chars) or a UUID device key
        if (input.length == 6 && !input.contains("-")) {
            // It's a pairing code — exchange it for device key via REST
            tvStatus.text = "Pairing..."
            tvStatus.setTextColor(0xFFF59E0B.toInt())
            tvError.visibility = View.GONE
            btnConnect.isEnabled = false

            exchangePairingCode(serverUrl, input)
        } else {
            // Treat as direct device key (legacy support)
            prefs.edit().apply {
                putString(KEY_DEVICE_KEY, input)
                putString(KEY_PAIRED_DEVICE_KEY, input)
                apply()
            }
            launchService(serverUrl, input)
        }
    }

    private fun exchangePairingCode(serverUrl: String, pairingCode: String) {
        // Derive HTTP base URL from WebSocket URL
        val httpBase = serverUrl
            .replace("ws://", "http://")
            .replace("wss://", "https://")
            .replace("/ws", "")

        val jsonBody = JSONObject().apply {
            put("pairingCode", pairingCode)
        }

        val request = Request.Builder()
            .url("$httpBase/api/pair")
            .post(jsonBody.toString().toRequestBody("application/json".toMediaType()))
            .build()

        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    tvError.text = "Pairing failed: ${e.message}"
                    tvError.visibility = View.VISIBLE
                    tvStatus.text = "Disconnected"
                    tvStatus.setTextColor(0xFFEF4444.toInt())
                    btnConnect.isEnabled = true
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                runOnUiThread {
                    try {
                        val json = JSONObject(body)
                        if (response.isSuccessful) {
                            val deviceKey = json.getString("deviceKey")
                            val deviceName = json.optString("deviceName", "")

                            // Store the resolved device key
                            val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                            prefs.edit().apply {
                                putString(KEY_PAIRED_DEVICE_KEY, deviceKey)
                                putString(KEY_DEVICE_KEY, pairingCode)
                                apply()
                            }

                            // Update UI to show paired state
                            etDeviceKey.setText("Paired")
                            etDeviceKey.isEnabled = false
                            btnResetPairing.visibility = View.VISIBLE

                            Log.i(TAG, "Paired successfully as: $deviceName ($deviceKey)")

                            // Now connect with the real device key
                            launchService(serverUrl = etServerUrl.text.toString().trim(), deviceKey)
                        } else {
                            val error = json.optString("error", "Invalid pairing code")
                            tvError.text = error
                            tvError.visibility = View.VISIBLE
                            tvStatus.text = "Disconnected"
                            tvStatus.setTextColor(0xFFEF4444.toInt())
                            btnConnect.isEnabled = true
                        }
                    } catch (e: Exception) {
                        tvError.text = "Pairing failed: unexpected response"
                        tvError.visibility = View.VISIBLE
                        tvStatus.text = "Disconnected"
                        tvStatus.setTextColor(0xFFEF4444.toInt())
                        btnConnect.isEnabled = true
                    }
                }
            }
        })
    }

    private fun launchService(serverUrl: String, deviceKey: String) {
        val intent = Intent(this, ProxyService::class.java).apply {
            action = ProxyService.ACTION_START
            putExtra(ProxyService.EXTRA_SERVER_URL, serverUrl)
            putExtra(ProxyService.EXTRA_DEVICE_KEY, deviceKey)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }

        isConnected = true
        btnConnect.text = "Disconnect"
        btnConnect.isEnabled = true
        btnConnect.setBackgroundColor(0xFFEF4444.toInt())
        etServerUrl.isEnabled = false
        etDeviceKey.isEnabled = false
        tvStatus.text = "Connecting..."
        tvStatus.setTextColor(0xFFF59E0B.toInt())
        tvError.visibility = View.GONE
    }

    private fun stopProxyService() {
        val intent = Intent(this, ProxyService::class.java).apply {
            action = ProxyService.ACTION_STOP
        }
        startService(intent)

        isConnected = false
        btnConnect.text = "Connect"
        btnConnect.setBackgroundColor(0xFF3B82F6.toInt())
        etServerUrl.isEnabled = true

        // Only re-enable device key input if not paired
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (prefs.getString(KEY_PAIRED_DEVICE_KEY, null) == null) {
            etDeviceKey.isEnabled = true
        }

        tvStatus.text = "Disconnected"
        tvStatus.setTextColor(0xFFEF4444.toInt())
        tvDeviceId.text = ""
        tvError.visibility = View.GONE
        btnChangeIp.visibility = View.GONE
    }
}
