package dev.orbitkit.app

import android.os.Bundle
import android.util.Log
import androidx.activity.enableEdgeToEdge
import dev.orbitkit.native.OrbitkitJniBridge


class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Ensure JNI bridge is initialized
    OrbitkitJniBridge.ensureLoaded()

    // Recover last known state from C4 persistence file if recorder plugin is present
    try {
      val clazz = Class.forName("dev.orbitkit.native.OrbitkitStatePersistence")
      val method = clazz.getMethod("recoverState", android.content.Context::class.java)
      val recovered = method.invoke(null, this)
      val state = recovered.javaClass.getMethod("getState").invoke(recovered)
      val bytes = recovered.javaClass.getMethod("getBytesRecorded").invoke(recovered)
      val count = recovered.javaClass.getMethod("getRecoveryCount").invoke(recovered)
      Log.i(
        "MainActivity",
        "[C4-PERSISTENCE] MainActivity onCreate: recovered state=$state, bytes=$bytes, recoveryCount=$count, pid=${android.os.Process.myPid()}"
      )
    } catch (_: Throwable) {
      // Recorder plugin absent
    }
  }
}
