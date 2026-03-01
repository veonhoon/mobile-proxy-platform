package com.mobileproxy.app

import android.Manifest
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton

class MainActivity : AppCompatActivity() {

    companion object {
        private const val PREFS_NAME = "mobile_proxy_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_DEVICE_KEY = "device_key"
        private const val NOTIFICATION_PERMISSION_CODE = 100
    }

    private lateinit var etServerUrl: EditText
    private lateinit var etDeviceKey: EditText
    private lateinit var btnConnect: MaterialButton
    private lateinit var tvStatus: TextView
    private lateinit var tvDeviceId: TextView
    private lateinit var tvError: TextView

    private var isConnected = false

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
                    }
                    ProxyService.STATUS_DISCONNECTED -> {
                        tvStatus.text = "Reconnecting..."
                        tvStatus.setTextColor(0xFFF59E0B.toInt())
                    }
                    ProxyService.STATUS_ERROR -> {
                        val error = intent.getStringExtra(ProxyService.EXTRA_ERROR) ?: ""
                        tvError.text = error
                        tvError.visibility = View.VISIBLE
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
        tvStatus = findViewById(R.id.tvStatus)
        tvDeviceId = findViewById(R.id.tvDeviceId)
        tvError = findViewById(R.id.tvError)

        // Load saved settings
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        etServerUrl.setText(prefs.getString(KEY_SERVER_URL, ""))
        etDeviceKey.setText(prefs.getString(KEY_DEVICE_KEY, ""))

        btnConnect.setOnClickListener {
            if (isConnected) {
                stopProxyService()
            } else {
                startProxyService()
            }
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
        val deviceKey = etDeviceKey.text.toString().trim()

        if (serverUrl.isEmpty()) {
            tvError.text = "Server URL is required"
            tvError.visibility = View.VISIBLE
            return
        }
        if (deviceKey.isEmpty()) {
            tvError.text = "Device Key is required"
            tvError.visibility = View.VISIBLE
            return
        }

        // Save settings
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().apply {
            putString(KEY_SERVER_URL, serverUrl)
            putString(KEY_DEVICE_KEY, deviceKey)
            apply()
        }

        // Start service
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
        etDeviceKey.isEnabled = true
        tvStatus.text = "Disconnected"
        tvStatus.setTextColor(0xFFEF4444.toInt())
        tvDeviceId.text = ""
        tvError.visibility = View.GONE
    }
}
