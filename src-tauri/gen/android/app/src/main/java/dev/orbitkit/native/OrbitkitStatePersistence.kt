package dev.orbitkit.native

import android.content.Context
import android.os.Process
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets

data class PersistedRecorderState(
    val state: String = "IDLE",
    val bytesRecorded: Long = 0L,
    val spoolPath: String = "",
    val updatedAt: Long = System.currentTimeMillis(),
    val lastAction: String = "INIT",
    val recoveryCount: Int = 0,
    val lastRecoveredAt: Long = 0L,
    val isForeground: Boolean = false,
    val processPid: Int = safeGetPid(),
    val lastError: String? = null
) {
    fun toJsonString(): String {
        fun escape(s: String): String = s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")
        return buildString {
            append("{\n")
            append("  \"state\": \"").append(escape(state)).append("\",\n")
            append("  \"bytesRecorded\": ").append(bytesRecorded).append(",\n")
            append("  \"spoolPath\": \"").append(escape(spoolPath)).append("\",\n")
            append("  \"updatedAt\": ").append(updatedAt).append(",\n")
            append("  \"lastAction\": \"").append(escape(lastAction)).append("\",\n")
            append("  \"recoveryCount\": ").append(recoveryCount).append(",\n")
            append("  \"lastRecoveredAt\": ").append(lastRecoveredAt).append(",\n")
            append("  \"isForeground\": ").append(isForeground).append(",\n")
            append("  \"processPid\": ").append(processPid).append(",\n")
            append("  \"lastError\": ").append(if (lastError == null) "null" else "\"${escape(lastError)}\"").append("\n")
            append("}")
        }
    }

    companion object {
        fun safeGetPid(): Int {
            return try {
                Process.myPid()
            } catch (_: Throwable) {
                0
            }
        }

        fun fromJsonString(jsonStr: String): PersistedRecorderState? {
            val trimmed = jsonStr.trim()
            if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
                return null
            }

            fun extractString(key: String): String? {
                val m = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"").find(jsonStr)
                return m?.groupValues?.get(1)
            }
            fun extractLong(key: String): Long? {
                val m = Regex("\"$key\"\\s*:\\s*(\\d+)").find(jsonStr)
                return m?.groupValues?.get(1)?.toLongOrNull()
            }
            fun extractInt(key: String): Int? {
                val m = Regex("\"$key\"\\s*:\\s*(\\d+)").find(jsonStr)
                return m?.groupValues?.get(1)?.toIntOrNull()
            }
            fun extractBoolean(key: String): Boolean? {
                val m = Regex("\"$key\"\\s*:\\s*(true|false)").find(jsonStr)
                return m?.groupValues?.get(1)?.toBoolean()
            }
            fun extractNullableString(key: String): String? {
                if (Regex("\"$key\"\\s*:\\s*null").containsMatchIn(jsonStr)) return null
                val m = Regex("\"$key\"\\s*:\\s*\"([^\"]*)\"").find(jsonStr)
                return m?.groupValues?.get(1)
            }

            val stateVal = extractString("state") ?: return null

            return PersistedRecorderState(
                state = stateVal,
                bytesRecorded = extractLong("bytesRecorded") ?: 0L,
                spoolPath = extractString("spoolPath") ?: "",
                updatedAt = extractLong("updatedAt") ?: System.currentTimeMillis(),
                lastAction = extractString("lastAction") ?: "INIT",
                recoveryCount = extractInt("recoveryCount") ?: 0,
                lastRecoveredAt = extractLong("lastRecoveredAt") ?: 0L,
                isForeground = extractBoolean("isForeground") ?: false,
                processPid = extractInt("processPid") ?: safeGetPid(),
                lastError = extractNullableString("lastError")
            )
        }
    }
}

object OrbitkitStatePersistence {
    private const val TAG = "OrbitkitPersistence"
    const val STATE_FILE_NAME = "recorder_state.json"
    const val STATE_TMP_FILE_NAME = "recorder_state.json.tmp"
    const val STATE_CORRUPT_FILE_NAME = "recorder_state.json.corrupt"

    private fun logI(msg: String) {
        try { Log.i(TAG, msg) } catch (_: Throwable) { println("[$TAG] $msg") }
    }
    private fun logW(msg: String) {
        try { Log.w(TAG, msg) } catch (_: Throwable) { println("[$TAG] WARN: $msg") }
    }
    private fun logD(msg: String) {
        try { Log.d(TAG, msg) } catch (_: Throwable) { println("[$TAG] DEBUG: $msg") }
    }
    private fun logE(msg: String, tr: Throwable? = null) {
        try { Log.e(TAG, msg, tr) } catch (_: Throwable) { println("[$TAG] ERROR: $msg ${tr?.message ?: ""}") }
    }

    @Volatile
    private var currentState: PersistedRecorderState = PersistedRecorderState()

    fun getCurrentState(): PersistedRecorderState = currentState

    // ------------------------------------------------------------------------
    // Path Resolvers (File-based core + Context delegates)
    // ------------------------------------------------------------------------

    fun getStateFile(baseDir: File): File = File(baseDir, STATE_FILE_NAME)
    fun getStateFile(context: Context): File = getStateFile(context.filesDir)

    fun getTmpStateFile(baseDir: File): File = File(baseDir, STATE_TMP_FILE_NAME)
    fun getTmpStateFile(context: Context): File = getTmpStateFile(context.filesDir)

    fun getCorruptStateFile(baseDir: File): File = File(baseDir, STATE_CORRUPT_FILE_NAME)
    fun getCorruptStateFile(context: Context): File = getCorruptStateFile(context.filesDir)

    // ------------------------------------------------------------------------
    // saveState: Atomic save with fsync & rename
    // ------------------------------------------------------------------------

    @Synchronized
    fun saveState(baseDir: File, state: PersistedRecorderState): Boolean {
        return try {
            if (!baseDir.exists()) {
                baseDir.mkdirs()
            }

            val targetFile = getStateFile(baseDir)
            val tmpFile = getTmpStateFile(baseDir)

            val jsonStr = state.toJsonString()
            val bytes = jsonStr.toByteArray(StandardCharsets.UTF_8)

            FileOutputStream(tmpFile).use { fos ->
                fos.write(bytes)
                fos.flush()
                try {
                    fos.fd.sync()
                } catch (_: Throwable) {
                    // Ignored on virtual / in-memory file systems
                }
            }

            // Atomic rename
            if (!tmpFile.renameTo(targetFile)) {
                // Fallback copy if rename fails across file system boundaries
                tmpFile.copyTo(targetFile, overwrite = true)
                tmpFile.delete()
            }

            currentState = state
            logI(
                "[C4-PERSISTENCE-SAVE] state=${state.state} bytes=${state.bytesRecorded} action=${state.lastAction} pid=${state.processPid} file=${targetFile.absolutePath} (${bytes.size} bytes)"
            )
            true
        } catch (e: Exception) {
            logE("[C4-PERSISTENCE-ERROR] Failed to save state file: ${e.message}", e)
            false
        }
    }

    fun saveState(context: Context, state: PersistedRecorderState): Boolean =
        saveState(context.filesDir, state)

    // ------------------------------------------------------------------------
    // loadState: Read and parse state file (returns null on missing or corrupt)
    // ------------------------------------------------------------------------

    @Synchronized
    fun loadState(baseDir: File): PersistedRecorderState? {
        val file = getStateFile(baseDir)
        if (!file.exists() || file.length() == 0L) {
            logD("[C4-PERSISTENCE-LOAD] State file does not exist: ${file.absolutePath}")
            return null
        }

        return try {
            val content = file.readText(StandardCharsets.UTF_8)
            val loaded = PersistedRecorderState.fromJsonString(content)
            if (loaded == null) {
                logW("[C4-PERSISTENCE-WARN] Corrupted state file content in ${file.name}: syntax invalid or missing 'state'")
                return null
            }
            logI(
                "[C4-PERSISTENCE-LOAD] Loaded state from ${file.name}: state=${loaded.state} bytes=${loaded.bytesRecorded} lastPid=${loaded.processPid}"
            )
            loaded
        } catch (e: Exception) {
            logE("[C4-PERSISTENCE-ERROR] Failed reading state file: ${e.message}", e)
            null
        }
    }

    fun loadState(context: Context): PersistedRecorderState? =
        loadState(context.filesDir)

    // ------------------------------------------------------------------------
    // recoverState: Core C4 lifecycle recovery algorithm
    // ------------------------------------------------------------------------

    @Synchronized
    fun recoverState(
        baseDir: File,
        currentPid: Int = PersistedRecorderState.safeGetPid()
    ): PersistedRecorderState {
        val targetFile = getStateFile(baseDir)
        val fileExisted = targetFile.exists() && targetFile.length() > 0L
        val prior = loadState(baseDir)

        if (fileExisted && prior == null) {
            // Corruption detected: state file exists on disk but failed to parse
            logW("[C4-PERSISTENCE-CORRUPT] Existing state file was corrupted; backing up to .corrupt and initializing fresh state")
            try {
                val corruptBackup = getCorruptStateFile(baseDir)
                targetFile.renameTo(corruptBackup)
            } catch (e: Exception) {
                logE("[C4-PERSISTENCE-ERROR] Failed to rename corrupt state file: ${e.message}", e)
            }

            val recoveredCorrupt = PersistedRecorderState(
                state = "IDLE",
                bytesRecorded = 0L,
                spoolPath = File(baseDir, "recorder_spool.pcm").absolutePath,
                updatedAt = System.currentTimeMillis(),
                lastAction = "RECOVERED_AFTER_CORRUPTION",
                recoveryCount = 1,
                lastRecoveredAt = System.currentTimeMillis(),
                isForeground = false,
                processPid = currentPid
            )
            saveState(baseDir, recoveredCorrupt)
            return recoveredCorrupt
        }

        if (prior == null) {
            logI("[C4-PERSISTENCE-RECOVERY] No prior state file found; initializing fresh IDLE state (pid=$currentPid)")
            val initial = PersistedRecorderState(
                state = "IDLE",
                bytesRecorded = 0L,
                spoolPath = File(baseDir, "recorder_spool.pcm").absolutePath,
                updatedAt = System.currentTimeMillis(),
                lastAction = "FRESH_INIT",
                recoveryCount = 0,
                lastRecoveredAt = 0L,
                isForeground = false,
                processPid = currentPid
            )
            saveState(baseDir, initial)
            return initial
        }

        val wasInterrupted = prior.isForeground || prior.state == "RECORDING" || prior.state == "PAUSED"
        val stateAfterDeath = if (wasInterrupted) "STOPPED" else prior.state
        val recoveryAction = if (wasInterrupted) {
            "RECOVERED_AFTER_PROCESS_DEATH (priorState=${prior.state}, priorPid=${prior.processPid})"
        } else {
            "RECOVERED_NORMAL (priorState=${prior.state})"
        }

        val recovered = prior.copy(
            state = stateAfterDeath,
            recoveryCount = prior.recoveryCount + 1,
            lastRecoveredAt = System.currentTimeMillis(),
            lastAction = recoveryAction,
            isForeground = false, // Foreground service ceases on process termination
            processPid = currentPid
        )

        logI(
            "[C4-PERSISTENCE-RECOVERY] Successfully recovered state! priorState=${prior.state} -> recoveredState=${recovered.state}, bytesRecorded=${recovered.bytesRecorded}, priorPid=${prior.processPid} -> newPid=$currentPid, recoveryCount=${recovered.recoveryCount}"
        )

        saveState(baseDir, recovered)
        return recovered
    }

    fun recoverState(context: Context): PersistedRecorderState =
        recoverState(context.filesDir)

    // ------------------------------------------------------------------------
    // State Transitions & Overlay Actions
    // ------------------------------------------------------------------------

    @Synchronized
    fun recordTransition(
        baseDir: File,
        newState: String,
        bytesRecorded: Long,
        spoolPath: String,
        actionName: String,
        isForeground: Boolean,
        lastError: String? = null
    ): PersistedRecorderState {
        val updated = currentState.copy(
            state = newState,
            bytesRecorded = bytesRecorded,
            spoolPath = spoolPath,
            updatedAt = System.currentTimeMillis(),
            lastAction = actionName,
            isForeground = isForeground,
            processPid = PersistedRecorderState.safeGetPid(),
            lastError = lastError
        )
        saveState(baseDir, updated)
        return updated
    }

    fun recordTransition(
        context: Context,
        newState: String,
        bytesRecorded: Long,
        spoolPath: String,
        actionName: String,
        isForeground: Boolean,
        lastError: String? = null
    ): PersistedRecorderState = recordTransition(
        context.filesDir, newState, bytesRecorded, spoolPath, actionName, isForeground, lastError
    )

    @Synchronized
    fun recordAction(baseDir: File, action: String): PersistedRecorderState {
        val updated = currentState.copy(
            lastAction = "OVERLAY_ACTION_$action",
            updatedAt = System.currentTimeMillis()
        )
        saveState(baseDir, updated)
        return updated
    }

    fun recordAction(context: Context, action: String): PersistedRecorderState =
        recordAction(context.filesDir, action)

    fun getStateJson(baseDir: File): String {
        val file = getStateFile(baseDir)
        return if (file.exists()) {
            file.readText(StandardCharsets.UTF_8)
        } else {
            currentState.toJsonString()
        }
    }

    fun getStateJson(context: Context): String = getStateJson(context.filesDir)
}
