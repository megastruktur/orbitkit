package dev.orbitkit.app

import android.os.Bundle
import android.util.Log
import androidx.activity.enableEdgeToEdge
import dev.orbitkit.native.OrbitkitJniBridge
import dev.orbitkit.native.OrbitkitStatePersistence

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Ensure JNI bridge is initialized
    OrbitkitJniBridge.ensureLoaded()

    // Recover last known state from C4 persistence file
    val recovered = OrbitkitStatePersistence.recoverState(this)
    Log.i(
      "MainActivity",
      "[C4-PERSISTENCE] MainActivity onCreate: recovered state=${recovered.state}, bytes=${recovered.bytesRecorded}, recoveryCount=${recovered.recoveryCount}, pid=${android.os.Process.myPid()}"
    )
  }
}
