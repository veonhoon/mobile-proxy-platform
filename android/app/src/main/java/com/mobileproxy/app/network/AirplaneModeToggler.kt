package com.mobileproxy.app.network

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log

object AirplaneModeToggler {

    private const val TAG = "AirplaneModeToggler"

    interface Callback {
        fun onSuccess()
        fun onError(message: String)
    }

    fun toggleAirplaneMode(context: Context, callback: Callback) {
        Thread {
            try {
                Log.i(TAG, "Enabling airplane mode...")
                setAirplaneMode(context, true)
                Thread.sleep(3000) // Wait for radio to fully disconnect

                Log.i(TAG, "Disabling airplane mode...")
                setAirplaneMode(context, false)
                Thread.sleep(2000) // Wait for cellular to reconnect with new IP

                Log.i(TAG, "Airplane mode toggle complete")
                callback.onSuccess()
            } catch (e: SecurityException) {
                Log.e(TAG, "Permission denied: ${e.message}")
                callback.onError(
                    "WRITE_SECURE_SETTINGS permission not granted. " +
                    "Run: adb shell pm grant com.mobileproxy.app android.permission.WRITE_SECURE_SETTINGS"
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error toggling airplane mode: ${e.message}", e)
                callback.onError("Failed to toggle airplane mode: ${e.message}")
            }
        }.start()
    }

    private fun setAirplaneMode(context: Context, enabled: Boolean) {
        val value = if (enabled) 1 else 0
        Settings.Global.putInt(
            context.contentResolver,
            Settings.Global.AIRPLANE_MODE_ON,
            value
        )
        // Broadcast the change so the system acts on it
        val intent = Intent(Intent.ACTION_AIRPLANE_MODE_CHANGED)
        intent.putExtra("state", enabled)
        context.sendBroadcast(intent)
    }
}
