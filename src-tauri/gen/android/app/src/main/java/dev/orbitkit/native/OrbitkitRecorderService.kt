package dev.orbitkit.native

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

class OrbitkitRecorderService : Service() {

    enum class State {
        IDLE,
        RECORDING,
        PAUSED,
        STOPPED
    }

    companion object {
        const val TAG = "OrbitkitRecorder"
        const val CHANNEL_ID = "orbitkit_recorder"
        const val CHANNEL_NAME = "OrbitKit Recorder"
        const val NOTIFICATION_ID = 2001
        const val STANDBY_NOTIFICATION_ID = 2002

        const val ACTION_START_FOREGROUND = "dev.orbitkit.native.action.START_FOREGROUND"
        const val ACTION_PAUSE = "dev.orbitkit.native.action.PAUSE"
        const val ACTION_RESUME = "dev.orbitkit.native.action.RESUME"
        const val ACTION_STOP = "dev.orbitkit.native.action.STOP"
        const val ACTION_POST_STANDBY_NOTIFICATION = "dev.orbitkit.native.action.POST_STANDBY"

        const val SAMPLE_RATE = 16000
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT

        val stateRef = AtomicReference(State.IDLE)
        val bytesRecorded = AtomicLong(0)
        val isForegroundActive = AtomicBoolean(false)
        @Volatile
        var spoolPath: String = ""
        @Volatile
        var lastError: String? = null

        fun getState(): State = stateRef.get()

        fun getSpoolFile(context: Context): File {
            return File(context.filesDir, "recorder_spool.pcm")
        }

        fun createNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                if (manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
                    val channel = NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_LOW
                    ).apply {
                        description = "Foreground notifications for OrbitKit microphone capture"
                        enableLights(false)
                        enableVibration(false)
                    }
                    manager.createNotificationChannel(channel)
                    Log.i(TAG, "Notification channel '$CHANNEL_ID' created")
                }
            }
        }

        fun postStandbyNotification(context: Context) {
            createNotificationChannel(context)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

            val startIntent = Intent(context, OrbitkitRecorderService::class.java).apply {
                action = ACTION_START_FOREGROUND
            }
            val startPendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PendingIntent.getForegroundService(
                    context,
                    201,
                    startIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            } else {
                PendingIntent.getService(
                    context,
                    201,
                    startIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            }

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle("OrbitKit Recorder Standby (S3b)")
                .setContentText("Cold start mic-FGS candidate test. Tap START:")
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .addAction(android.R.drawable.ic_media_play, "START", startPendingIntent)

            nm.notify(STANDBY_NOTIFICATION_ID, builder.build())
            Log.i(TAG, "Posted standby notification for S3b test (id=$STANDBY_NOTIFICATION_ID)")
        }

        fun cancelStandbyNotification(context: Context) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.cancel(STANDBY_NOTIFICATION_ID)
        }
    }

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val isRecordingRunning = AtomicBoolean(false)
    private val isPaused = AtomicBoolean(false)
    private var fileOutputStream: FileOutputStream? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "OrbitkitRecorderService onCreate")
        createNotificationChannel(this)
        OrbitkitJniBridge.ensureLoaded()
        val recovered = OrbitkitStatePersistence.recoverState(this)
        Log.i(TAG, "[C4-PERSISTENCE] Service onCreate: recovered state=${recovered.state}, bytes=${recovered.bytesRecorded}, recoveryCount=${recovered.recoveryCount}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START_FOREGROUND
        Log.i(TAG, "OrbitkitRecorderService onStartCommand action=$action startId=$startId")

        when (action) {
            ACTION_START_FOREGROUND -> {
                handleStartForeground()
            }
            ACTION_PAUSE -> {
                handlePause()
            }
            ACTION_RESUME -> {
                handleResume()
            }
            ACTION_STOP -> {
                handleStop()
            }
            ACTION_POST_STANDBY_NOTIFICATION -> {
                postStandbyNotification(this)
            }
            else -> {
                Log.w(TAG, "Unknown action: $action")
            }
        }

        return START_NOT_STICKY
    }

    private fun handleStartForeground() {
        Log.i(TAG, "handleStartForeground invoked, currentState=${stateRef.get()}")
        if (stateRef.get() == State.RECORDING) {
            Log.i(TAG, "Recorder already recording, ignoring start request")
            return
        }

        cancelStandbyNotification(this)

        // 1. Check RECORD_AUDIO permission
        val hasPermission = checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!hasPermission) {
            Log.e(TAG, "Cannot start mic recording: RECORD_AUDIO permission not granted")
            lastError = "RECORD_AUDIO permission not granted"
            stopSelf()
            return
        }

        // 2. Start Foreground with notification
        try {
            val notification = buildForegroundNotification("RECORDING")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isForegroundActive.set(true)
            Log.i(TAG, "startForeground succeeded with FOREGROUND_SERVICE_TYPE_MICROPHONE")
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed: ${e::class.java.simpleName}: ${e.message}", e)
            lastError = "startForeground failed: ${e.message}"
            OrbitkitStatePersistence.recordTransition(
                this,
                State.STOPPED.name,
                bytesRecorded.get(),
                spoolPath,
                "START_FAILED",
                false,
                lastError
            )
            stopSelf()
            return
        }

        // 3. Initialize AudioRecord and file output
        try {
            val spool = getSpoolFile(this)
            spool.parentFile?.mkdirs()
            // Reset spool file for fresh recording session
            if (spool.exists()) {
                spool.delete()
            }
            spool.createNewFile()
            spoolPath = spool.absolutePath
            bytesRecorded.set(0)
            fileOutputStream = FileOutputStream(spool, false)

            val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            val bufferSize = Math.max(minBuf, 4096)

            val record = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            )

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord initialization failed (state=${record.state})")
                lastError = "AudioRecord failed to initialize"
                record.release()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }

            audioRecord = record
            record.startRecording()
            isRecordingRunning.set(true)
            isPaused.set(false)
            stateRef.set(State.RECORDING)
            lastError = null
            OrbitkitStatePersistence.recordTransition(
                this,
                State.RECORDING.name,
                bytesRecorded.get(),
                spoolPath,
                "START_FOREGROUND",
                true
            )
            OrbitkitJniBridge.dispatchNativeAction("REC_START")
            // 4. Start spooling thread
            recordingThread = Thread({
                val buffer = ByteArray(bufferSize)
                Log.i(TAG, "AudioRecord spooling thread started (bufferSize=$bufferSize)")
                val fos = fileOutputStream
                while (isRecordingRunning.get()) {
                    if (isPaused.get()) {
                        try {
                            Thread.sleep(50)
                        } catch (e: InterruptedException) {
                            break
                        }
                        continue
                    }

                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: -1
                    if (read > 0 && fos != null) {
                        try {
                            fos.write(buffer, 0, read)
                            fos.flush()
                            val total = bytesRecorded.addAndGet(read.toLong())
                            // Persist audio byte growth periodically (every ~32KB)
                            if (total % 32768L < read) {
                                OrbitkitStatePersistence.recordTransition(
                                    this@OrbitkitRecorderService,
                                    State.RECORDING.name,
                                    total,
                                    spoolPath,
                                    "RECORDING_PROGRESS",
                                    true
                                )
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed writing audio chunk to spool", e)
                            break
                        }
                    } else if (read < 0) {
                        Log.w(TAG, "AudioRecord read returned code: $read")
                        try {
                            Thread.sleep(20)
                        } catch (e: InterruptedException) {
                            break
                        }
                    }
                }
                Log.i(TAG, "AudioRecord spooling thread finished. Total bytes=${bytesRecorded.get()}")
            }, "OrbitkitAudioSpooler").apply {
                priority = Thread.MAX_PRIORITY
                start()
            }

            Log.i(TAG, "OrbitkitRecorderService active in foreground. Spool: $spoolPath")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing AudioRecord: ${e::class.java.simpleName}: ${e.message}", e)
            lastError = "AudioRecord init error: ${e.message}"
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun handlePause() {
        Log.i(TAG, "handlePause invoked, currentState=${stateRef.get()}")
        if (stateRef.get() != State.RECORDING) {
            Log.w(TAG, "Cannot pause: recorder is not in RECORDING state")
            return
        }

        try {
            isPaused.set(true)
            audioRecord?.stop()
            stateRef.set(State.PAUSED)
            updateNotification("PAUSED")
            OrbitkitStatePersistence.recordTransition(
                this,
                State.PAUSED.name,
                bytesRecorded.get(),
                spoolPath,
                "PAUSE",
                true
            )
            OrbitkitJniBridge.dispatchNativeAction("REC_PAUSE")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to pause AudioRecord", e)
            lastError = "Pause error: ${e.message}"
        }
    }

    private fun handleResume() {
        Log.i(TAG, "handleResume invoked, currentState=${stateRef.get()}")
        if (stateRef.get() != State.PAUSED) {
            Log.w(TAG, "Cannot resume: recorder is not in PAUSED state")
            return
        }

        try {
            audioRecord?.startRecording()
            isPaused.set(false)
            stateRef.set(State.RECORDING)
            updateNotification("RECORDING")
            OrbitkitStatePersistence.recordTransition(
                this,
                State.RECORDING.name,
                bytesRecorded.get(),
                spoolPath,
                "RESUME",
                true
            )
            OrbitkitJniBridge.dispatchNativeAction("REC_RESUME")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to resume AudioRecord", e)
            lastError = "Resume error: ${e.message}"
        }
    }

    private fun handleStop() {
        Log.i(TAG, "handleStop invoked, currentState=${stateRef.get()}")
        isRecordingRunning.set(false)
        isPaused.set(false)

        try {
            recordingThread?.interrupt()
            recordingThread?.join(500)
        } catch (e: Exception) {
            Log.d(TAG, "Exception waiting for spool thread", e)
        }
        recordingThread = null

        try {
            audioRecord?.stop()
        } catch (e: Exception) {
            Log.d(TAG, "Exception stopping AudioRecord", e)
        }

        try {
            audioRecord?.release()
        } catch (e: Exception) {
            Log.d(TAG, "Exception releasing AudioRecord", e)
        }
        audioRecord = null

        try {
            fileOutputStream?.flush()
            fileOutputStream?.close()
        } catch (e: Exception) {
            Log.d(TAG, "Exception closing spool output stream", e)
        }
        fileOutputStream = null

        stateRef.set(State.STOPPED)
        isForegroundActive.set(false)
        OrbitkitStatePersistence.recordTransition(
            this,
            State.STOPPED.name,
            bytesRecorded.get(),
            spoolPath,
            "STOP",
            false
        )
        OrbitkitJniBridge.dispatchNativeAction("REC_STOP")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
        Log.i(TAG, "OrbitkitRecorderService stopped cleanly. Final bytes: ${bytesRecorded.get()}, spool: $spoolPath")
    }

    private fun updateNotification(stateLabel: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.notify(NOTIFICATION_ID, buildForegroundNotification(stateLabel))
    }

    private fun buildForegroundNotification(stateLabel: String): Notification {
        val pauseIntent = Intent(this, OrbitkitRecorderService::class.java).apply {
            action = ACTION_PAUSE
        }
        val pausePendingIntent = PendingIntent.getService(
            this,
            1,
            pauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val resumeIntent = Intent(this, OrbitkitRecorderService::class.java).apply {
            action = ACTION_RESUME
        }
        val resumePendingIntent = PendingIntent.getService(
            this,
            2,
            resumeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, OrbitkitRecorderService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            3,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } else null

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("OrbitKit Microphone Recorder")
            .setContentText("Status: $stateLabel | Bytes: ${bytesRecorded.get()}")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentPendingIntent)

        if (stateLabel == "RECORDING") {
            builder.addAction(android.R.drawable.ic_media_pause, "PAUSE", pausePendingIntent)
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "STOP", stopPendingIntent)
        } else {
            builder.addAction(android.R.drawable.ic_media_play, "RESUME", resumePendingIntent)
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "STOP", stopPendingIntent)
        }

        return builder.build()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "OrbitkitRecorderService onDestroy")
        if (stateRef.get() == State.RECORDING || stateRef.get() == State.PAUSED) {
            handleStop()
        }
    }
}
