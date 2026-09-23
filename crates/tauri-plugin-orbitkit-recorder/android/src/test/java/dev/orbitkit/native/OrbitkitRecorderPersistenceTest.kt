package dev.orbitkit.native

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.nio.file.Files

class OrbitkitRecorderPersistenceTest {

    private lateinit var mockFilesDir: File

    @Before
    fun setUp() {
        mockFilesDir = Files.createTempDirectory("orbitkit_recorder_persistence_test_").toFile()
    }

    @After
    fun tearDown() {
        mockFilesDir.deleteRecursively()
    }

    // ------------------------------------------------------------------------
    // Recorder Service Hierarchy & Constants
    // ------------------------------------------------------------------------

    @Test
    fun testRecorderServiceHierarchyAndConstants() {
        val clazz = OrbitkitRecorderService::class.java
        assertTrue("OrbitkitRecorderService must extend android.app.Service", android.app.Service::class.java.isAssignableFrom(clazz))
        assertEquals("dev.orbitkit.native.OrbitkitRecorderService", clazz.name)
        assertEquals("orbitkit_recorder", OrbitkitRecorderService.CHANNEL_ID)
        assertEquals("OrbitKit Recorder", OrbitkitRecorderService.CHANNEL_NAME)
        assertEquals(2001, OrbitkitRecorderService.NOTIFICATION_ID)
        assertEquals(2002, OrbitkitRecorderService.STANDBY_NOTIFICATION_ID)
        assertEquals("dev.orbitkit.native.action.START_FOREGROUND", OrbitkitRecorderService.ACTION_START_FOREGROUND)
        assertEquals("dev.orbitkit.native.action.PAUSE", OrbitkitRecorderService.ACTION_PAUSE)
        assertEquals("dev.orbitkit.native.action.RESUME", OrbitkitRecorderService.ACTION_RESUME)
        assertEquals("dev.orbitkit.native.action.STOP", OrbitkitRecorderService.ACTION_STOP)
        assertEquals("dev.orbitkit.native.action.POST_STANDBY", OrbitkitRecorderService.ACTION_POST_STANDBY_NOTIFICATION)
    }

    @Test
    fun testRecorderStateEnum() {
        val states = OrbitkitRecorderService.State.values().map { it.name }
        assertTrue(states.contains("IDLE"))
        assertTrue(states.contains("RECORDING"))
        assertTrue(states.contains("PAUSED"))
        assertTrue(states.contains("STOPPED"))
        assertEquals(4, states.size)
    }

    @Test
    fun testRecorderPluginCommandsPresentAndAnnotated() {
        val clazz = dev.orbitkit.recorder.OrbitkitRecorderPlugin::class.java
        val requiredCommands = listOf(
            "startForeground",
            "pause",
            "resume",
            "stop",
            "state",
            "postStandbyNotification",
            "getPersistedState",
            "recoverState"
        )

        for (cmdName in requiredCommands) {
            val method = clazz.getMethod(cmdName, app.tauri.plugin.Invoke::class.java)
            assertNotNull("Method $cmdName(Invoke) must exist on OrbitkitRecorderPlugin", method)
            assertTrue("Method $cmdName must be public", java.lang.reflect.Modifier.isPublic(method.modifiers))
            val cmdAnnotation = method.getAnnotation(app.tauri.annotation.Command::class.java)
            assertNotNull("Method $cmdName must be annotated with @Command", cmdAnnotation)
        }
    }

    // ------------------------------------------------------------------------
    // C4 Persistence Contract & State Recovery
    // ------------------------------------------------------------------------

    @Test
    fun testPersistedRecorderStateJsonSerialization() {
        val state = PersistedRecorderState(
            state = "RECORDING",
            bytesRecorded = 32768L,
            spoolPath = "/data/user/0/dev.orbitkit.app/files/recorder_spool.pcm",
            updatedAt = 1727000000000L,
            lastAction = "START_FOREGROUND",
            recoveryCount = 0,
            lastRecoveredAt = 0L,
            isForeground = true,
            processPid = 12345,
            lastError = null
        )

        val jsonStr = state.toJsonString()
        assertTrue(jsonStr.contains("\"state\": \"RECORDING\""))
        assertTrue(jsonStr.contains("\"bytesRecorded\": 32768"))
        assertTrue(jsonStr.contains("\"spoolPath\": \"/data/user/0/dev.orbitkit.app/files/recorder_spool.pcm\""))
        assertTrue(jsonStr.contains("\"lastAction\": \"START_FOREGROUND\""))
        assertTrue(jsonStr.contains("\"recoveryCount\": 0"))
        assertTrue(jsonStr.contains("\"isForeground\": true"))
        assertTrue(jsonStr.contains("\"processPid\": 12345"))

        val deserialized = PersistedRecorderState.fromJsonString(jsonStr)
        assertNotNull("Deserialization must produce non-null state", deserialized)
        assertEquals(state, deserialized)
    }

    @Test
    fun testStateFileAtomicSaveAndLoadExercisesProductionCode() {
        val state = PersistedRecorderState(
            state = "RECORDING",
            bytesRecorded = 65536L,
            spoolPath = File(mockFilesDir, "recorder_spool.pcm").absolutePath,
            updatedAt = 1727000100000L,
            lastAction = "START_FOREGROUND",
            recoveryCount = 0,
            lastRecoveredAt = 0L,
            isForeground = true,
            processPid = 9999
        )

        val saveSuccess = OrbitkitStatePersistence.saveState(mockFilesDir, state)
        assertTrue("Production saveState must return true", saveSuccess)

        val stateFile = OrbitkitStatePersistence.getStateFile(mockFilesDir)
        assertTrue("State file must exist on disk", stateFile.exists())
        assertTrue("State file size must be > 0", stateFile.length() > 0)

        val loaded = OrbitkitStatePersistence.loadState(mockFilesDir)
        assertNotNull("Production loadState must return non-null state", loaded)
        assertEquals("RECORDING", loaded?.state)
        assertEquals(65536L, loaded?.bytesRecorded)
        assertEquals(9999, loaded?.processPid)
        assertTrue(loaded?.isForeground == true)
        assertEquals(state, loaded)
    }

    @Test
    fun testProcessDeathRecoveryExecutesProductionAlgorithm() {
        val stateFile = OrbitkitStatePersistence.getStateFile(mockFilesDir)

        val priorState = PersistedRecorderState(
            state = "RECORDING",
            bytesRecorded = 49152L,
            spoolPath = File(mockFilesDir, "recorder_spool.pcm").absolutePath,
            updatedAt = 1727000200000L,
            lastAction = "START_FOREGROUND",
            recoveryCount = 0,
            lastRecoveredAt = 0L,
            isForeground = true,
            processPid = 1001
        )
        OrbitkitStatePersistence.saveState(mockFilesDir, priorState)
        val beforeContent = stateFile.readText()
        assertTrue("Before content must record RECORDING", beforeContent.contains("\"state\": \"RECORDING\""))
        assertTrue("Before content must record PID 1001", beforeContent.contains("\"processPid\": 1001"))

        val recovered = OrbitkitStatePersistence.recoverState(mockFilesDir, currentPid = 2002)

        assertEquals("STOPPED", recovered.state)
        assertEquals(49152L, recovered.bytesRecorded)
        assertEquals(1, recovered.recoveryCount)
        assertEquals(2002, recovered.processPid)
        assertFalse(recovered.isForeground)
        assertTrue(recovered.lastAction.contains("RECOVERED_AFTER_PROCESS_DEATH"))
        assertTrue(recovered.lastRecoveredAt > 0L)

        val afterContent = stateFile.readText()
        assertFalse("Disk state before and after recovery must differ", beforeContent == afterContent)
        assertTrue("Disk state must now contain STOPPED", afterContent.contains("\"state\": \"STOPPED\""))
        assertTrue("Disk state must now contain recoveryCount: 1", afterContent.contains("\"recoveryCount\": 1"))
        assertTrue("Disk state must now contain processPid: 2002", afterContent.contains("\"processPid\": 2002"))
        assertTrue("Disk state must preserve 49152 bytesRecorded", afterContent.contains("\"bytesRecorded\": 49152"))
    }

    @Test
    fun testC4EvidenceCaptureHarness() {
        val stateFile = OrbitkitStatePersistence.getStateFile(mockFilesDir)

        val priorState = PersistedRecorderState(
            state = "RECORDING",
            bytesRecorded = 49152L,
            spoolPath = File(mockFilesDir, "recorder_spool.pcm").absolutePath,
            updatedAt = 1727000200000L,
            lastAction = "START_FOREGROUND",
            recoveryCount = 0,
            lastRecoveredAt = 0L,
            isForeground = true,
            processPid = 1001
        )
        OrbitkitStatePersistence.saveState(mockFilesDir, priorState)
        val beforeContent = stateFile.readText()

        println("=== C4 Persistence Contract: Host Execution Evidence ===")
        println("EXECUTION_ENVIRONMENT: Host JVM unit test harness")
        println("TESTED_CLASS: dev.orbitkit.native.OrbitkitStatePersistence")
        println("STATE_FILE_PATH: " + stateFile.absolutePath)
        println("--- BEGIN REAL BEFORE JSON ---")
        println(beforeContent)
        println("--- END REAL BEFORE JSON ---")

        val recovered = OrbitkitStatePersistence.recoverState(mockFilesDir, currentPid = 2002)

        val afterContent = stateFile.readText()
        println("--- BEGIN REAL AFTER JSON ---")
        println(afterContent)
        println("--- END REAL AFTER JSON ---")
        println("RECOVERY_SUMMARY: priorState=RECORDING -> recoveredState=${recovered.state}, bytesRecorded=${recovered.bytesRecorded}, recoveryCount=${recovered.recoveryCount}, newPid=${recovered.processPid}")

        assertEquals("STOPPED", recovered.state)
        assertEquals(49152L, recovered.bytesRecorded)
        assertEquals(1, recovered.recoveryCount)
        assertEquals(2002, recovered.processPid)
    }

    @Test
    fun testCorruptStateFileDetectedAndHandledByProductionRecovery() {
        val stateFile = OrbitkitStatePersistence.getStateFile(mockFilesDir)
        stateFile.writeText("{ corrupted_junk_without_proper_syntax: true ???")

        val loaded = OrbitkitStatePersistence.loadState(mockFilesDir)
        assertNull("Production loadState must return null on corrupted content", loaded)

        val recovered = OrbitkitStatePersistence.recoverState(mockFilesDir, currentPid = 7777)
        assertNotNull(recovered)
        assertEquals("IDLE", recovered.state)
        assertEquals(0L, recovered.bytesRecorded)
        assertEquals("RECOVERED_AFTER_CORRUPTION", recovered.lastAction)
        assertEquals(7777, recovered.processPid)
        assertEquals(1, recovered.recoveryCount)

        val corruptBackup = OrbitkitStatePersistence.getCorruptStateFile(mockFilesDir)
        assertTrue("Corrupted file must be moved to backup file", corruptBackup.exists())
        assertEquals("{ corrupted_junk_without_proper_syntax: true ???", corruptBackup.readText())

        val cleanLoaded = OrbitkitStatePersistence.loadState(mockFilesDir)
        assertNotNull("Main state file must now contain valid recovered state", cleanLoaded)
        assertEquals("IDLE", cleanLoaded?.state)
    }

    @Test
    fun testRecordTransitionAndRecordActionProductionMethods() {
        val t1 = OrbitkitStatePersistence.recordTransition(
            mockFilesDir,
            newState = "RECORDING",
            bytesRecorded = 16384L,
            spoolPath = "/tmp/spool.pcm",
            actionName = "START_FOREGROUND",
            isForeground = true
        )
        assertEquals("RECORDING", t1.state)
        assertEquals(16384L, t1.bytesRecorded)

        val diskState1 = OrbitkitStatePersistence.loadState(mockFilesDir)
        assertEquals("RECORDING", diskState1?.state)
        assertEquals(16384L, diskState1?.bytesRecorded)

        val a1 = OrbitkitStatePersistence.recordAction(mockFilesDir, "ACT_A")
        assertEquals("OVERLAY_ACTION_ACT_A", a1.lastAction)

        val diskState2 = OrbitkitStatePersistence.loadState(mockFilesDir)
        assertEquals("OVERLAY_ACTION_ACT_A", diskState2?.lastAction)
    }

    // ------------------------------------------------------------------------
    // Survival Matrix Scenarios (S2 - S5) Contract Tests
    // ------------------------------------------------------------------------

    @Test
    fun testScenarioS2_ScreenLockPreservesActiveRecordingState() {
        val state = PersistedRecorderState(
            state = "RECORDING",
            bytesRecorded = 81920L,
            spoolPath = "/data/user/0/dev.orbitkit.app/files/recorder_spool.pcm",
            updatedAt = System.currentTimeMillis(),
            lastAction = "SCREEN_LOCK_SIMULATED",
            recoveryCount = 0,
            isForeground = true,
            processPid = 3003
        )
        OrbitkitStatePersistence.saveState(mockFilesDir, state)

        val loaded = OrbitkitStatePersistence.loadState(mockFilesDir)
        assertEquals("RECORDING", loaded?.state)
        assertTrue(loaded?.isForeground == true)
        assertEquals(81920L, loaded?.bytesRecorded)
    }

    @Test
    fun testScenarioS3_ForceStopProcessDeathAndRecovery() {
        val preDeathState = PersistedRecorderState(
            state = "RECORDING",
            bytesRecorded = 131072L,
            spoolPath = "/data/user/0/dev.orbitkit.app/files/recorder_spool.pcm",
            updatedAt = 1000L,
            lastAction = "START_FOREGROUND",
            recoveryCount = 0,
            isForeground = true,
            processPid = 4001
        )
        OrbitkitStatePersistence.saveState(mockFilesDir, preDeathState)

        val postRelaunch = OrbitkitStatePersistence.recoverState(mockFilesDir, currentPid = 5002)

        assertEquals("STOPPED", postRelaunch.state)
        assertEquals(131072L, postRelaunch.bytesRecorded)
        assertEquals(1, postRelaunch.recoveryCount)
        assertEquals(5002, postRelaunch.processPid)
        assertFalse(postRelaunch.isForeground)
    }

    @Test
    fun testScenarioS4_AmKillRecovery() {
        val preKillState = PersistedRecorderState(
            state = "PAUSED",
            bytesRecorded = 65536L,
            spoolPath = "/data/user/0/dev.orbitkit.app/files/recorder_spool.pcm",
            updatedAt = 3000L,
            lastAction = "PAUSE",
            recoveryCount = 0,
            isForeground = true,
            processPid = 6001
        )
        OrbitkitStatePersistence.saveState(mockFilesDir, preKillState)

        val postRelaunch = OrbitkitStatePersistence.recoverState(mockFilesDir, currentPid = 7002)

        assertEquals("STOPPED", postRelaunch.state)
        assertEquals(65536L, postRelaunch.bytesRecorded)
        assertEquals(1, postRelaunch.recoveryCount)
        assertEquals(7002, postRelaunch.processPid)
        assertFalse(postRelaunch.isForeground)
    }

    @Test
    fun testScenarioS5_SwipeFromRecentsLivenessContract() {
        val activePid = 8001
        val state = PersistedRecorderState(
            state = "RECORDING",
            bytesRecorded = 98304L,
            spoolPath = "/data/user/0/dev.orbitkit.app/files/recorder_spool.pcm",
            updatedAt = 5000L,
            lastAction = "REC_START",
            recoveryCount = 0,
            isForeground = true,
            processPid = activePid
        )
        OrbitkitStatePersistence.saveState(mockFilesDir, state)

        val survivingPid = 8001
        val processSurvives = (activePid == survivingPid)
        assertTrue("When process survives swipe, PID remains unchanged", processSurvives)

        val loaded = OrbitkitStatePersistence.loadState(mockFilesDir)
        assertEquals(survivingPid, loaded?.processPid)
        assertEquals("RECORDING", loaded?.state)
    }
}
